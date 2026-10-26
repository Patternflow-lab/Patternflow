// ===== Patternflow pattern =====
// Title:   Stokes Drift
// Family:  wave
// Idea:    A deep-water wave runs to the right across a cross-section of water 109 LEDs deep, and the particles stepped through its velocity field each trace a little orbit that falls short of closing, so the dye lines dropped straight down lean forward at the top along the curve e^(2kz) while the dots far below hardly stir.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Stokes drift (George Gabriel Stokes, 1847), against the trochoidal wave (Franz Gerstner, 1802), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Steepness=0.15..0.4, Gerstner=0..1
//
// Knob 1: Hue. Turns the four dye lines round the wheel together, magenta, gold, mint and azure at 0 from the left, and the dots' pale tint with them, pale green at 0; the surface stays white.
// Knob 2: Speed. The wave's period, 2.6 s divided by the knob: 1.3 s at 2, 13 s at 0.2 and 0.87 s at 3. The wavelength stays 256 LEDs, four panel widths, so the panel shows a quarter of a wave.
// Knob 3: Steepness. ak, the wave's amplitude times its wavenumber. At 0.15 the surface rises and falls 6.1 LEDs either side of its mean and the water at the top creeps 5.8 LEDs a period; at 0.25 10.2 LEDs and 16 a period; at 0.4 16.3 LEDs and 41 a period. The drift halves every 14.1 LEDs of depth, the orbits every 28.2. New dye drops when the top of the old has run 48 LEDs or after 12 periods.
// Knob 4: Gerstner. Where each particle reads the wave's velocity. At 0 it reads it where it is, Airy's linear wave in Euler's view, and the orbits leave the drift omega k a^2 e^(2kz) behind; at 1 it reads it at the centre of its own orbit, which is Gerstner's exact trochoidal wave, whose orbits close and the dye lines only sway. In between the drift is close to 1 minus the knob times the full one: 0.94 at the opening 0.06, 0.52 at 0.5.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sin, cos, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Wavelength and domain: the water is periodic over one wavelength, 256
// LEDs, and the panel shows the first 64 of it.
const L = 256, K = (2 * PI) / L;
// The mean surface sits on row 18; depth runs down to row 127, 109 LEDs.
const SURF = 18, DEEP = H - 1 - SURF;
// Material: a dot every 8 LEDs across and down, four dye lines of 220
// points packed towards the top, and a chain of 256 surface particles.
const DX = 8, DZ = 8, NLINE = 4, NPT = 220, NSURF = 256;
const LINE_X = [8, 24, 40, 56];
const HUES = [0.88, 0.13, 0.42, 0.6];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A set of particles: position (x, z), z up from the mean surface, x not
// wrapped so a particle's whole run can be read; and (rx, rz), the centre of
// its orbit as the linear wave would have it. Dots and the surface are
// placed by their centres and seated on their orbits.
function pack(n) {
  return { n, x: new Float64Array(n), z: new Float64Array(n), rx: new Float64Array(n), rz: new Float64Array(n) };
}
function place(P, i, x, z) {
  P.x[i] = P.rx[i] = x;
  P.z[i] = P.rz[i] = z;
}

export function setup(params) {
  const nd = (L / DX) * floor(DEEP / DZ + 1);
  const s = {
    ph: 0, hue: 0, speed: 2, ak: 0.15, akSeat: -1, g: 0.06, age: 0, fade: 0,
    dots: pack(nd), lines: pack(NLINE * NPT), old: pack(NLINE * NPT), surf: pack(NSURF),
    trail: new Float32Array(W * H), rgb: new Float32Array(W * H * 3), c: new Float32Array(3),
  };
  let i = 0;
  for (let z = -4; z >= -DEEP; z -= DZ) for (let x = 4; x < L; x += DX) place(s.dots, i++, x, z);
  s.dots.n = i;
  for (let j = 0; j < NSURF; j++) place(s.surf, j, j * (L / NSURF), 0);
  seat(s);
  dye(s);
  params.s = s;
}

// Fresh dye lines, dropped straight down from the surface chain to the bottom,
// their points packed towards the top where the water moves most. Each
// point's orbit centre is found from where it is.
function dye(s) {
  const a = s.ak / K;
  for (let l = 0; l < NLINE; l++) {
    const x0 = LINE_X[l], top = level(s.surf, x0);
    for (let k = 0; k < NPT; k++) {
      const i = l * NPT + k, z0 = top + (-DEEP - top) * (k / (NPT - 1)) ** 1.6;
      s.lines.x[i] = s.lines.rx[i] = x0;
      s.lines.z[i] = s.lines.rz[i] = z0;
      centre(s.lines, i, a, s.ph, 12);
    }
  }
  s.age = 0;
}

// The height of the surface chain above x: the pair of neighbours that
// straddles x, wrapped onto one wavelength.
function level(S, x) {
  for (let j = 0; j < S.n; j++) {
    const k = j + 1 < S.n ? j + 1 : 0;
    const x1 = S.x[j] - floor(S.x[j] / L) * L;
    let x2 = S.x[k] - floor(S.x[k] / L) * L;
    if (x2 < x1 - L / 2) x2 += L;
    for (const xx of [x, x + L])
      if (xx >= x1 && xx < x2) return S.z[j] + ((S.z[k] - S.z[j]) * (xx - x1)) / (x2 - x1);
  }
  return 0;
}

// The surface is a material line, and at steep waves its particles bunch
// at some crests and leave gaps elsewhere. When a gap opens past 1.2 LEDs
// the chain is laid out again at even steps along the same curve, each new
// point with its own orbit centre.
function even(s) {
  const S = s.surf, n = S.n, a = s.ak / K, cum = new Float64Array(n + 1);
  let gap = 0;
  for (let j = 0; j < n; j++) {
    const k = j + 1 < n ? j + 1 : 0, dx = S.x[k] + (k ? 0 : L) - S.x[j], d = Math.hypot(dx, S.z[k] - S.z[j]);
    cum[j + 1] = cum[j] + d;
    gap = max(gap, d);
  }
  if (gap < 1.2) return;
  const ox = Float64Array.from(S.x), oz = Float64Array.from(S.z), orx = Float64Array.from(S.rx), orz = Float64Array.from(S.rz);
  for (let m = 0, j = 0; m < n; m++) {
    const want = (cum[n] * m) / n;
    while (cum[j + 1] < want) j++;
    const k = j + 1 < n ? j + 1 : 0, u = (want - cum[j]) / max(1e-9, cum[j + 1] - cum[j]), w = k ? 0 : L;
    S.x[m] = ox[j] + (ox[k] + w - ox[j]) * u;
    S.z[m] = oz[j] + (oz[k] - oz[j]) * u;
    S.rx[m] = orx[j] + (orx[k] + w - orx[j]) * u;
    S.rz[m] = orz[j] + (orz[k] - orz[j]) * u;
    centre(S, m, a, s.ph, 6);
  }
}

// The orbit centre r of a particle at p: p = r + xi(r), where the linear
// wave moves a particle by xi = a e^(k rz) (-sin, cos)(k rx - phase); found
// by turns of the fixed point from the last centre.
function centre(P, i, a, ph, turns) {
  const x = P.x[i], z = P.z[i];
  let rx = P.rx[i], rz = P.rz[i];
  for (let it = 0; it < turns; it++) {
    const e = a * exp(K * rz), th = K * rx - ph;
    rx = x + e * sin(th);
    rz = z - e * cos(th);
  }
  P.rx[i] = rx;
  P.rz[i] = rz;
}

// Every particle put back on its orbit for steepness ak, keeping the orbit's
// centre, and the surface chain's centres on the mean surface. After a turn
// of Steepness the old orbits would leave dots above the new troughs, and a
// particle above the water rides the linear wave's crest away.
function seat(s) {
  const a = s.ak / K;
  for (const P of [s.dots, s.lines, s.old, s.surf])
    for (let i = 0; i < P.n; i++) {
      if (P === s.surf) P.rz[i] = 0;
      const rz = min(0, P.rz[i]), e = a * exp(K * rz), th = K * P.rx[i] - s.ph;
      P.rz[i] = rz;
      P.x[i] = P.rx[i] - e * sin(th);
      P.z[i] = rz + e * cos(th);
    }
  s.akSeat = s.ak;
}

// One step of every particle in a set from phase ph by dph (radians of the
// wave, so dt = dph / omega). The velocity of the linear deep-water wave
// eta = a cos(kx - wt) is a w e^(kz) (cos, sin)(kx - wt); per radian of
// phase, which is how it is stepped here, the w drops out. Airy's particles
// read it where they are; Gerstner's read it at their orbit's centre. The
// knob g reads it at centre + (1 - g)(where they are - centre). Only the
// Airy reading feels the wave's gradient across the orbit, and that is all
// the drift there is: nothing pushes a particle forward by hand.
function step(P, ph, dph, ak, g) {
  const a = ak / K, h = dph, f = 1 - g;
  for (let i = 0; i < P.n; i++) {
    centre(P, i, a, ph, 2);
    const x = P.x[i], z = P.z[i], rx = P.rx[i], rz = P.rz[i];
    // Classical fourth-order Runge-Kutta with the centre held for the step.
    let k1x, k1z, k2x, k2z, k3x, k3z, k4x, k4z, px, pz, e, th;
    px = rx + f * (x - rx);
    pz = rz + f * (z - rz);
    e = a * exp(K * pz);
    th = K * px - ph;
    k1x = e * cos(th);
    k1z = e * sin(th);
    px = rx + f * (x + 0.5 * h * k1x - rx);
    pz = rz + f * (z + 0.5 * h * k1z - rz);
    e = a * exp(K * pz);
    th = K * px - ph - 0.5 * h;
    k2x = e * cos(th);
    k2z = e * sin(th);
    px = rx + f * (x + 0.5 * h * k2x - rx);
    pz = rz + f * (z + 0.5 * h * k2z - rz);
    e = a * exp(K * pz);
    k3x = e * cos(K * px - ph - 0.5 * h);
    k3z = e * sin(K * px - ph - 0.5 * h);
    px = rx + f * (x + h * k3x - rx);
    pz = rz + f * (z + h * k3z - rz);
    e = a * exp(K * pz);
    th = K * px - ph - h;
    k4x = e * cos(th);
    k4z = e * sin(th);
    P.x[i] = x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    P.z[i] = z + (h / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
    // A particle thrown over the crests is put back on its orbit.
    if (!(P.z[i] < 1.6 * a)) {
      const c = min(0, rz), e2 = a * exp(K * c);
      P.x[i] = rx - e2 * sin(K * rx - ph - h);
      P.z[i] = c + e2 * cos(K * rx - ph - h);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0.15, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.speed = cl(kv[1], 0.2, 3);
  s.ak = cl(kv[2], 0.15, 0.4);
  s.g = cl(kv[3], 0, 1);
  if (s.ak !== s.akSeat) seat(s);
  // Phase advance this frame, in steps of at most 0.1 rad.
  const dph = ((2 * PI) / 2.6) * s.speed * d, n = Math.ceil(dph / 0.1);
  for (let k = 0; k < n; k++) {
    for (const P of [s.dots, s.lines, s.surf]) step(P, s.ph, dph / n, s.ak, s.g);
    if (s.fade > 0) step(s.old, s.ph, dph / n, s.ak, s.g);
    s.ph += dph / n;
  }
  // The surface chain's orbit centres are eased back onto the mean surface,
  // a twentieth a frame. Left alone, at Steepness past 0.33 particles that
  // started at a crest and at a trough settle at slightly different mean
  // heights, drift at different speeds and fold the line within a minute.
  const S = s.surf, a = s.ak / K;
  for (let j = 0; j < S.n; j++) {
    centre(S, j, a, s.ph, 2);
    const dz = 0.05 * S.rz[j];
    S.rz[j] -= dz;
    S.z[j] -= dz;
  }
  even(s);
  s.age += dph;
  s.fade = max(0, s.fade - d * 1.2);
  // New dye when the top of the lines has run 48 LEDs ahead, or after 12
  // periods; the old lines fade out over a second.
  const run = s.lines.x[0] - LINE_X[0];
  if (run > 48 || s.age > 12 * 2 * PI) {
    const t = s.old;
    s.old = s.lines;
    s.lines = t;
    s.fade = 1;
    dye(s);
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const T = s.trail, B = s.rgb, c = s.c;
  // The dots leave a short trail, so each traces its orbit.
  for (let i = 0; i < W * H; i++) T[i] *= 0.9;
  B.fill(0);
  const wrap = (x) => x - floor(x / L) * L;
  const splat = (buf, x, y, v) => {
    const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const X = x0 + dx, Y = y0 + dy;
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const wgt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
        buf[Y * W + X] += v * wgt;
      }
  };
  const D = s.dots;
  for (let i = 0; i < D.n; i++) {
    let x = wrap(D.x[i]);
    if (x > L - 1) x -= L;
    if (x < W + 1) splat(T, x, SURF - D.z[i], 0.3);
  }
  // A line through a chain of points, drawn as samples every half LED, each
  // lighting its four nearest LEDs by how near it falls.
  const chain = (P, from, to, r, g, b, closed) => {
    for (let i = from; i < to - (closed ? 0 : 1); i++) {
      const j = i + 1 < to ? i + 1 : from;
      const x1 = wrap(P.x[i]);
      let x2 = wrap(P.x[j]);
      if (x2 - x1 > L / 2) x2 -= L;
      else if (x1 - x2 > L / 2) x2 += L;
      const y1 = SURF - P.z[i], y2 = SURF - P.z[j];
      const m = max(1, Math.ceil(2 * max(abs(x2 - x1), abs(y2 - y1))));
      for (let k = 0; k < m; k++) {
        const u = k / m, y = y1 + (y2 - y1) * u;
        let xx = x1 + (x2 - x1) * u;
        if (xx > W + 1) xx -= L;
        if (xx < -1 || xx > W + 1) continue;
        const x0 = floor(xx - 0.5), y0 = floor(y - 0.5), fx = xx - 0.5 - x0, fy = y - 0.5 - y0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const X = x0 + dx, Y = y0 + dy;
            if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
            const wgt = min(1, 2 * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy)), o = (Y * W + X) * 3;
            B[o] = max(B[o], r * wgt);
            B[o + 1] = max(B[o + 1], g * wgt);
            B[o + 2] = max(B[o + 2], b * wgt);
          }
      }
    }
  };
  for (let l = 0; l < NLINE; l++) {
    hsv(HUES[l] + s.hue, 0.75, 1, c, 0);
    chain(s.lines, l * NPT, (l + 1) * NPT, c[0], c[1], c[2], false);
    if (s.fade > 0) chain(s.old, l * NPT, (l + 1) * NPT, c[0] * s.fade * 0.6, c[1] * s.fade * 0.6, c[2] * s.fade * 0.6, false);
  }
  chain(s.surf, 0, NSURF, 0.85, 0.88, 0.95, true);
  // The dots in a pale tint half the wheel from the first dye line.
  hsv(HUES[0] + 0.5 + s.hue, 0.55, 0.62, c, 0);
  const dr = c[0], dg = c[1], db = c[2];
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3, t = min(0.5, T[p]);
      display.setPixel(x, y, round(min(1, B[o] + t * dr) * 255), round(min(1, B[o + 1] + t * dg) * 255), round(min(1, B[o + 2] + t * db) * 255));
    }
}
