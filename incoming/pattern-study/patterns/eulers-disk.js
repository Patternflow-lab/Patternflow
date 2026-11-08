// ===== Patternflow pattern =====
// Title:   Euler's Disk
// Family:  physics
// Idea:    A thin steel disk let go on a table at a tilt rolls round on its rim while the tilt falls as the cube root of the time left and the precession rate climbs as that time to the power minus one sixth, until at a finite moment the disk lies flat and buzzes, and under it two plots draw those two curves with a cursor running to the end.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euler's disk and its finite-time singularity (H. K. Moffatt, Nature, 2000; the year, the exponents 1/3 and -1/6 and the small-tilt rate Omega squared = 4 g / (R alpha) are from memory); the ten digits drawn for Kasiski Examination (pattern round 108), copied from kasiski-examination.js, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, View=35..80, Start=0.4..0.7
//
// Knob 1: Hue. Turns every colour round the wheel together, skipping the stretch from orange to lime that reads brown on a shaded face. At 0 the disk is azure with a pale rim, and the spoke, the contact glint and the tilt plot are gold and the precession plot is magenta; at 0.25 the disk is violet, at 0.5 rose and at 0.75 green.
// Knob 2: Speed. At 2 a run takes 20 s, from a first precession of 1 turn a second (for a start of 0.45 rad) to the flat disk, then the hum holds 2.6 s and the picture fades out and in over 1.1 s, so the cycle is 23.2 s. The slow motion is fixed so that the formula's rate at 0.45 rad, for a disk of radius 4 cm, shows as 1 turn a second, and it holds at every speed. At 0.2 everything is ten times slower and the first precession takes 10 s; at 3 a run is 13.3 s.
// Knob 3: View. The camera's height above the table, 35 to 80 degrees, looking at the disk from the front. The flat disk measures 53 LEDs wide and 33 tall at 35, 45 tall at 55 and 52 tall at 80. The face goes edge-on when the disk leans away from the camera by as many degrees as the camera is high: at 35 that is 0.61 rad, which a start of 0.7 stays beyond for its first 7 s and a start of 0.4 never reaches.
// Knob 4: Start. The tilt a run starts from, 0.4 to 0.7 rad (23 to 40 degrees), with a random 0.08 rad either way at each run. The precession rate goes as 1 over the square root of the tilt, so a start of 0.7 opens at 0.8 turns a second and 0.4 at 1.06, and the tilt plot starts higher. A turn of more than 0.12 rad starts a new run at once; a smaller one waits for the next run. The spoke on the face stays pointing one way in the room while the face rocks under it, because the spin that rolling without slipping asks for, minus Omega cos(alpha), cancels the turning of the frame (worked out here, not from memory).

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, atan2, PI, pow, hypot, random } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The disk, in LEDs: 26 radius, 2.2 thick, on a table that is the plane z = 0.
const R = 26, HH = 1.1;
// The picture takes the top SCENE rows; the plots take the rest.
const SCENE = 72, Y0 = 38, Z0 = 8;
// Moffatt's rolling disk, small tilt: Omega^2 = 4 g / (R alpha), from memory, with a coin of radius 4 cm.
// The slow motion makes the first precession 1 turn a second at a tilt of 0.45 rad.
const G = 9.81, RM = 0.04;
const SLOW = TAU / sqrt((4 * G) / (RM * 0.45));
// A run lasts RUN seconds at Speed 2 from the tilt a0 to the singular moment t0 = RUN; the picture stops at a tilt of A_END, 0.7 degrees.
const RUN = 20, HUM = 2.6, FADE = 0.6, A_END = 0.012;
const NS = 8;
// The beam over the disk: apex HS up, and radius RP on the table.
const HS = 70, RP = 40, KC = RP / HS;
// Light, fixed, in front of the disk and to its left; unit length is taken below.
const LX = -0.55, LY = -0.5, LZ = 0.7, LN = sqrt(LX * LX + LY * LY + LZ * LZ);
const L0 = [LX / LN, LY / LN, LZ / LN];
// Where inside the pixel each of the NS sub-samples looks: the first points of the Halton sequence, bases 2 and 3.
const JX = [0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0625], JY = [1 / 3, 2 / 3, 1 / 9, 4 / 9, 7 / 9, 2 / 9, 5 / 9, 8 / 9];
// The plots: the tilt on top, the precession under it, 53 columns of time.
const X0 = 8, X1 = 60, NC = X1 - X0 + 1, A_TOP = 76, A_BASE = 98, O_TOP = 103, O_BASE = 125;
const A_MAX = 0.8, O_MAX = 3.6;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The knob's wheel runs from azure at 0 round violet and rose to red, then from lime round to azure, so the dark half of the shading never sits on orange.
const wheel = (k) => (0.22 + ((0.33 + 0.81 * k) % 0.81)) % 1;

// Ten digits, 3 wide and 5 tall, copied from kasiski-examination.js.
const DIGIT = [
  "###|#.#|#.#|#.#|###", ".#.|##.|.#.|.#.|###", "###|..#|###|#..|###", "###|..#|###|..#|###", "#.#|#.#|###|..#|..#",
  "###|#..|###|..#|###", "###|#..|###|#.#|###", "###|..#|..#|.#.|.#.", "###|#.#|###|#.#|###", "###|#.#|###|..#|###",
].map((g) => g.replace(/\|/g, "").split("").map((c) => c === "#"));

function newRun(S, start) {
  S.runStart = start;
  S.a0 = cl(start + (random() - 0.5) * 0.16, 0.2, 0.8);
  S.phi0 = random() * TAU;
  S.beta0 = random() * TAU;
  // Omega at the start, in radians per second of the run at Speed 2: the formula, slowed.
  S.om0 = SLOW * sqrt((4 * G) / (RM * S.a0));
  S.uEnd = pow(A_END / S.a0, 3);
  S.tEnd = RUN * (1 - S.uEnd);
  S.tau = 0;
  S.dtau = 0;
  S.phase = 0;
  S.humT = 0;
  S.fadeT = 0;
  S.age = 0;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, elev: 0.6, start: 0.4, fl: 1, clock: 0,
    acc: new Float32Array(W * SCENE * 3), rgb: new Float32Array(W * H * 3),
  };
  newRun(params.s, 0.4);
  // The first update starts the run again from the Start knob where it really stands.
  params.s.runStart = -9;
}

// The run, with u the share of the time left. Moffatt's scalings, all from memory:
// the tilt alpha = a0 u^(1/3) and the precession rate Omega = Omega0 u^(-1/6), so that Omega^2 alpha stays what it was.
// The precession angle is the integral of Omega. The spin of the disk about its own axis, relative to the turning frame, is
// minus Omega cos(alpha) (the contact point must not slip), integrated with cos alpha taken to second order.
const uOf = (S, t) => max(1 - t / RUN, S.uEnd);
const alphaAt = (S, t) => S.a0 * pow(uOf(S, t), 1 / 3);
const omegaAt = (S, t) => S.om0 * pow(uOf(S, t), -1 / 6);
const phiAt = (S, t) => S.phi0 + S.om0 * RUN * 1.2 * (1 - pow(uOf(S, t), 5 / 6));
function betaAt(S, t) {
  const u = uOf(S, t), Phi = S.om0 * RUN * 1.2 * (1 - pow(u, 5 / 6));
  return S.beta0 - (Phi - ((S.a0 * S.a0 * S.om0 * RUN) / 3) * (1 - pow(u, 1.5)));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 35, 0.4], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.elev = (cl(kv[2], 35, 80) * PI) / 180;
  S.start = cl(kv[3], 0.4, 0.7);
  S.clock += d;
  S.age += d;
  const g = (d * S.speed) / 2;
  S.dtau = g;
  if (abs(S.start - S.runStart) > 0.12) newRun(S, S.start);
  if (S.phase === 0) {
    S.tau += g;
    if (S.tau >= S.tEnd) {
      S.tau = S.tEnd;
      S.phase = 1;
      S.humT = 0;
    }
  } else if (S.phase === 1) {
    S.humT += g;
    if (S.humT >= HUM) (S.phase = 2), (S.fadeT = 0);
  } else {
    S.fadeT += d;
    if (S.fadeT >= FADE) newRun(S, S.start);
  }
  // The hum is a flicker from frame to frame.
  S.fl = S.phase === 1 ? 0.5 + 0.5 * random() : 1;
}

// The disk's pose for one sub-sample, shared by the ray cast below.
let nx = 0, ny = 0, nz = 1, dx = 1, dy = 0, dz = 0, cp = 1, sp = 0, zc = 0;
let hitT = 0, hitEx = 0, hitAv = 0;

// A ray b + t v against the thick disk: the slab between two planes, cut by the cylinder of radius R round the disk's axis.
// Returns 0 for a miss, 1 for a face, 2 for the rim wall; hitT is where the ray enters, hitEx where it leaves.
function cast(bx, by, bz, vx, vy, vz) {
  const wz = bz - zc;
  const a0 = bx * nx + by * ny + wz * nz, av = vx * nx + vy * ny + vz * nz;
  let t1, t2;
  if (abs(av) < 1e-7) {
    if (abs(a0) > HH) return 0;
    t1 = -1e9;
    t2 = 1e9;
  } else {
    t1 = (-HH - a0) / av;
    t2 = (HH - a0) / av;
    if (t1 > t2) {
      const s = t1;
      t1 = t2;
      t2 = s;
    }
  }
  const A = 1 - av * av, B = bx * vx + by * vy + wz * vz - a0 * av, C = bx * bx + by * by + wz * wz - a0 * a0 - R * R;
  const D = B * B - A * C;
  if (D < 0 || A < 1e-9) return 0;
  const sq = sqrt(D), ta = (-B - sq) / A, tb = (-B + sq) / A;
  const en = max(t1, ta), ex = min(t2, tb);
  if (en > ex) return 0;
  hitT = en;
  hitEx = ex;
  hitAv = av;
  return t1 >= ta ? 1 : 2;
}


// How far the ray b + t v runs inside the cone of light, between the table and its apex: where x^2 + y^2 <= KC^2 (HS - z)^2.
function beam(sx, by, bz, se, ce) {
  const m = HS - bz, K2 = KC * KC, A = ce * ce - K2 * se * se, B = 2 * by * ce - 2 * K2 * m * se, C = sx * sx + by * by - K2 * m * m;
  const zlo = (bz - HS) / se, zhi = bz / se;
  if (abs(A) < 1e-6) return 0;
  const D = B * B - 4 * A * C;
  if (D <= 0) return A < 0 ? zhi - zlo : 0;
  const sq = sqrt(D);
  let ta = (-B - sq) / (2 * A), tb = (-B + sq) / (2 * A);
  if (ta > tb) {
    const q = ta;
    ta = tb;
    tb = q;
  }
  if (A > 0) return max(0, min(tb, zhi) - max(ta, zlo));
  return max(0, min(ta, zhi) - zlo) + max(0, zhi - max(tb, zlo));
}

function scene(S) {
  const e = S.elev, se = sin(e), ce = cos(e), acc = S.acc, hum = S.phase === 1;
  acc.fill(0);
  const h = wheel(S.hue), hot = h + 0.57;
  const face = [0, 0, 0], rimC = [0, 0, 0], under = [0, 0, 0], spoke = [0, 0, 0], glint = [0, 0, 0], tab = [0, 0, 0], ringC = [0, 0, 0];
  hsv(h, 0.62, 1, face, 0);
  hsv(h, 0.2, 1, rimC, 0);
  hsv(h, 0.6, 0.62, under, 0);
  hsv(hot, 0.68, 1, spoke, 0);
  hsv(hot, 0.16, 1, glint, 0);
  hsv(h, 0.55, 1, tab, 0);
  hsv(hot, 0.7, 1, ringC, 0);
  // The camera sits at (0, -ce, se) looking down at the table; the half vector for the gloss.
  const hx = L0[0], hy = L0[1] - ce, hz = L0[2] + se, hn = hypot(hx, hy, hz), Hx = hx / hn, Hy = hy / hn, Hz = hz / hn;
  const Lx = L0[0], Ly = L0[1], Lz = L0[2];
  const r0 = R * cos(S.a0);
  const wave = hum ? exp(-S.humT / 0.7) : 0, flashP = hum ? exp(-S.humT / 0.25) : 0;
  const waveR = R + S.humT * 24;
  for (let s = 0; s < NS; s++) {
    const ts = max(0, S.tau - (S.dtau * (s + 0.5)) / NS);
    let alpha, phi, beta, swept;
    if (hum) {
      // Past the end the disk turns faster than the frames can follow: its tilt is a few hundredths of a degree and its azimuth is anything.
      alpha = A_END * (0.4 + 0.6 * random());
      phi = random() * TAU;
      beta = random() * TAU;
      swept = 1e9;
    } else {
      alpha = alphaAt(S, ts);
      phi = phiAt(S, ts);
      beta = betaAt(S, ts);
      swept = phi - S.phi0;
    }
    const sa = sin(alpha), ca = cos(alpha);
    cp = cos(phi);
    sp = sin(phi);
    nx = sa * cp;
    ny = sa * sp;
    nz = ca;
    dx = ca * cp;
    dy = ca * sp;
    dz = -sa;
    zc = R * sa + HH * ca;
    const cb = cos(beta), sb = sin(beta);
    const rNow = R * ca;
    const jx = JX[s] - 0.5 + (hum ? (random() - 0.5) * 1.2 : 0), jy = JY[s] - 0.5 + (hum ? (random() - 0.5) * 1.6 : 0);
    const syC = (zc - Z0) * ce, rr = (R + HH + 1.5) * (R + HH + 1.5);
    for (let py = 0; py < SCENE; py++) {
      const sy = Y0 - (py + 0.5 + jy), by = sy * se, bz = Z0 + sy * ce;
      for (let px = 0; px < W; px++) {
        const sx = px + 0.5 + jx - 32, o = (py * W + px) * 3;
        let kind = 0;
        if (sx * sx + (sy - syC) * (sy - syC) < rr) kind = cast(sx, by, bz, 0, ce, -se);
        if (kind) {
          const t = hitT, qx = sx - 0, qy = by + t * ce, qz = bz - t * se - zc;
          const a = qx * nx + qy * ny + qz * nz;
          let cr, cg, cb2;
          if (kind === 1) {
            const sgn = hitAv > 0 ? -1 : 1;
            const u1 = qx * dx + qy * dy + qz * dz, u2 = -qx * sp + qy * cp, rho = hypot(u1, u2);
            if (sgn > 0 && rho > R - 1.7) {
              // The bevel of the upper face: the rim ring, the brightest line of the disk.
              const k = 0.72 + 0.28 * max(0, nx * Lx + ny * Ly + nz * Lz);
              cr = rimC[0] * k;
              cg = rimC[1] * k;
              cb2 = rimC[2] * k;
            } else {
              // Fine rings cut in the face tilt its normal along the radius, so the light that lies on a ring comes and goes round it as the face turns.
              const gr = sgn > 0 ? 0.42 * sin((TAU * rho) / 6.5 + 0.6) : 0.1;
              const ir = rho > 1e-6 ? 1 / rho : 0;
              const rx = (u1 * dx - u2 * sp) * ir, ry = (u1 * dy + u2 * cp) * ir, rz = u1 * dz * ir;
              let Nx = sgn * nx + gr * rx, Ny = sgn * ny + gr * ry, Nz = sgn * nz + gr * rz;
              const nn = 1 / hypot(Nx, Ny, Nz);
              Nx *= nn;
              Ny *= nn;
              Nz *= nn;
              const dif = max(0, Nx * Lx + Ny * Ly + Nz * Lz), nh = max(0, Nx * Hx + Ny * Hy + Nz * Hz);
              const gl = nh * nh;
              const spec = sgn > 0 ? gl * gl * gl * 0.4 : 0;
              if (sgn > 0) {
                const k = 0.2 + 0.72 * dif;
                cr = face[0] * k + spec;
                cg = face[1] * k + spec;
                cb2 = face[2] * k + spec;
                const along = u1 * cb + u2 * sb, perp = u2 * cb - u1 * sb;
                if (along > 4 && along < R - 3.5 && abs(perp) < 1.1) {
                  const w = 0.7 + 0.5 * dif;
                  cr = spoke[0] * w;
                  cg = spoke[1] * w;
                  cb2 = spoke[2] * w;
                } else if (rho < 2.4) {
                  cr = rimC[0] * 0.9;
                  cg = rimC[1] * 0.9;
                  cb2 = rimC[2] * 0.9;
                }
              } else {
                const k = 0.35 + 0.9 * dif;
                cr = under[0] * k;
                cg = under[1] * k;
                cb2 = under[2] * k;
              }
            }
          } else {
            // The wall of the rim, lit by its own normal, pale.
            const ix = qx - a * nx, iy = qy - a * ny, iz = qz - a * nz, in_ = 1 / hypot(ix, iy, iz);
            const dif = max(0, (ix * Lx + iy * Ly + iz * Lz) * in_);
            const k = 0.5 + 0.55 * dif;
            cr = rimC[0] * k;
            cg = rimC[1] * k;
            cb2 = rimC[2] * k;
          }
          acc[o] += cr;
          acc[o + 1] += cg;
          acc[o + 2] += cb2;
        } else {
          // The table: a pool of light under the disk, its shadow, and the ring the contact point has run.
          const tt = bz / se, Tx = sx, Ty = by + tt * ce, rt = hypot(Tx, Ty);
          let br = 0, cone = 0;
          cone = beam(sx, by, bz, se, ce);
          if (rt < 2.1 * R) {
            const f = rt / RP;
            br = f < 1 ? (0.36 + 0.4 * flashP) * sm((1 - f) / 0.55) : 0;
          }
          let sh = 1;
          if (rt < 1.5 * R && cast(Tx, Ty, 0.05, Lx, Ly, Lz) && hitEx > 0.05) sh = 0.3;
          let rg = 0;
          const dist = rt < rNow ? rNow - rt : rt > r0 ? rt - r0 : 0;
          if (dist < 1.4) {
            const shape = cl(1 - (dist - 0.3) / 1.0, 0, 1);
            if (hum) rg = shape * 0.8;
            else {
              let dl = (phi - atan2(Ty, Tx)) % TAU;
              if (dl < 0) dl += TAU;
              if (swept >= dl) rg = shape * (0.2 + 0.75 * exp(-dl / 0.6));
            }
          }
          let wv = 0;
          if (wave > 0.01) {
            const q = (rt - waveR) / 1.6;
            wv = wave * exp(-q * q) * 0.9;
          }
          br = br * sh + min(cone * 0.0042, 0.26) * (0.6 + 0.4 * sh);
          rg *= 0.4 + 0.6 * sh;
          acc[o] += tab[0] * br + ringC[0] * rg + wv * glint[0];
          acc[o + 1] += tab[1] * br + ringC[1] * rg + wv * glint[1];
          acc[o + 2] += tab[2] * br + ringC[2] * rg + wv * glint[2];
        }
      }
    }
    // The glint at the contact point, and a glow round it, hidden mostly when the disk stands between it and the camera.
    const Px = R * ca * cp, Py = R * ca * sp;
    const gx = 32 + Px + jx * 0, gy = Y0 - (Py * se - Z0 * ce);
    const k = cast(Px + 1.5 * cp, Py + 1.5 * sp, 0.8, 0, -ce, se) && hitEx > 0.1 ? 0.28 : 1;
    const y0 = max(0, floor(gy - 5)), y1 = min(SCENE - 1, floor(gy + 5)), x0 = max(0, floor(gx - 5)), x1 = min(W - 1, floor(gx + 5));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const r2 = (x + 0.5 - gx) * (x + 0.5 - gx) + (y + 0.5 - gy) * (y + 0.5 - gy), o = (y * W + x) * 3;
        const i = exp(-r2 / 2.2) * 1.5 * k + exp(-r2 / 10) * 0.3 * k;
        acc[o] += glint[0] * i;
        acc[o + 1] += glint[1] * i;
        acc[o + 2] += glint[2] * i;
      }
  }
  // Average the sub-samples into the frame; the picture fades into the plots at its foot, and in and out at a run's ends.
  const fin = sm(S.age / 0.5), fout = S.phase === 2 ? 1 - sm(S.fadeT / FADE) : 1, gain = (fin * fout * S.fl) / NS;
  const rgb = S.rgb;
  for (let y = 0; y < H; y++) {
    if (y >= SCENE) {
      rgb.fill(0, y * W * 3, (y + 1) * W * 3);
      continue;
    }
    const m = gain * cl((SCENE - 1 - y) / 8, 0, 1);
    for (let i = y * W * 3; i < (y + 1) * W * 3; i++) rgb[i] = acc[i] * m;
  }
}

// Light a pixel of the frame: colour col at weight w, toward col.
function put(rgb, x, y, col, w) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const o = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) rgb[o + k] += (col[k] - rgb[o + k]) * min(1, w);
}

function digits(rgb, text, x, y, col, w) {
  for (const ch of text) {
    if (ch === ".") {
      put(rgb, x, y + 4, col, w);
      x += 2;
      continue;
    }
    const g = DIGIT[ch.charCodeAt(0) - 48];
    for (let i = 0; i < 15; i++) if (g[i]) put(rgb, x + (i % 3), y + floor(i / 3), col, w);
    x += 4;
  }
}

function plots(S) {
  const rgb = S.rgb, hum = S.phase === 1, h = wheel(S.hue);
  const colA = [0, 0, 0], colO = [0, 0, 0], veilA = [0, 0, 0], veilO = [0, 0, 0], axis = [0, 0, 0], white = [1, 1, 1];
  hsv(h + 0.57, 0.8, 1, colA, 0);
  hsv(h + 0.33, 0.75, 1, colO, 0);
  hsv(h + 0.57, 0.4, 1, veilA, 0);
  hsv(h + 0.33, 0.4, 1, veilO, 0);
  hsv(h, 0.3, 0.6, axis, 0);
  const g = sm(S.age / 0.5) * (S.phase === 2 ? 1 - sm(S.fadeT / FADE) : 1);
  const tc = S.phase === 0 ? S.tau : S.tEnd;
  const kc = min(NC - 1, floor((tc / S.tEnd) * NC));
  const flash = hum ? exp(-S.humT / 0.5) : 0;
  // Rows run down, so a larger value is a smaller row.
  const yA = (t) => A_BASE - (alphaAt(S, t) / A_MAX) * (A_BASE - A_TOP);
  const yO = (t) => O_BASE - (omegaAt(S, t) / TAU / O_MAX) * (O_BASE - O_TOP);
  // The frame: a baseline and a left edge for each plot, ticks at each quarter of the run, and a dotted line at t0 where the curves are cut off.
  for (const [top, base] of [[A_TOP, A_BASE], [O_TOP, O_BASE]]) {
    for (let x = X0 - 2; x <= X1 + 1; x++) put(rgb, x, base + 1, axis, 0.6 * g);
    for (let y = top - 2; y <= base + 1; y++) put(rgb, X0 - 2, y, axis, 0.6 * g);
    for (let q = 1; q < 4; q++) put(rgb, X0 + floor((q * NC) / 4), base, axis, 0.6 * g);
  }
  for (let y = A_TOP - 2; y <= O_BASE + 1; y += 2) put(rgb, X1 + 2, y, white, 0.4 * g);
  // The curves, a column of time at a time: the line covers the rows the curve crosses in that column, and below it a veil.
  for (let p = 0; p < 2; p++) {
    const col = p ? colO : colA, top = p ? O_TOP : A_TOP, base = p ? O_BASE : A_BASE, yf = p ? yO : yA;
    for (let k = 0; k < NC; k++) {
      const fa = yf((k / NC) * S.tEnd), fb = yf(((k + 1) / NC) * S.tEnd), past = k <= kc;
      const lo = cl(min(fa, fb), top - 1, base) - 0.45, hi = cl(max(fa, fb), top - 1, base) + 0.45;
      for (let y = max(top - 1, floor(lo)); y <= base; y++) {
        const on = cl(min(y + 1, hi) - max(y, lo), 0, 1);
        if (on > 0) put(rgb, X0 + k, y, col, on * (past ? 1 : 0.55) * g);
        else if (y >= hi) put(rgb, X0 + k, y, p ? veilO : veilA, (past ? 0.24 : 0.1) * g);
      }
    }
  }
  // Numbers: the tilt in degrees, and the precession in turns a second as the panel shows it.
  const deg = S.phase ? 0 : floor((alphaAt(S, tc) * 180) / PI + 0.5), tps = (omegaAt(S, tc) / TAU) * (S.speed / 2);
  const dtxt = String(deg);
  digits(rgb, dtxt, X1 - (dtxt.length * 4 - 1), A_TOP, colA, 0.85 * g);
  digits(rgb, tps < 9.95 ? tps.toFixed(1) : "9.9", X0 + 1, O_TOP, colO, 0.85 * g);
  // The cursor through both plots, a dot on each curve, and the flash at the end.
  for (let y = A_TOP - 2; y <= O_BASE + 1; y++) put(rgb, X0 + kc, y, white, (0.3 + 0.5 * flash) * g);
  for (const [t, yf, col] of [[tc, yA, colA], [tc, yO, colO]]) {
    const cy = floor(cl(yf(t), A_TOP - 1, O_BASE));
    put(rgb, X0 + kc, cy, white, g);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(rgb, X0 + kc + ox, cy + oy, col, 0.9 * g);
  }
  if (hum) for (let y = A_TOP - 2; y <= O_BASE + 1; y++) put(rgb, X1 + 1, y, white, flash * 0.9);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  scene(S);
  plots(S);
  const rgb = S.rgb;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
