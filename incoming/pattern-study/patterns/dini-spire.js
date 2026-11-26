// ===== Patternflow pattern =====
// Title:   Dini Spire
// Family:  dinisurface
// Idea:    Dini's twisted pseudosphere, the surface of constant negative curvature, stands up the panel as one needle of glossy iridescent film that flares to a rim at its foot and winds in to a hair at its tip, cut by its own lines of constant u and constant t, while the twist swells and slackens from Beltrami's straight horn to a hard screw and the grooves and the patches of film slide up it.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dini's surface (Ulisse Dini, 1865), the twisted pseudosphere of Gauss curvature -1/(a^2+b^2); the pseudosphere (Eugenio Beltrami, 1868) is its b = 0 case, the surface turned from the tractrix (Claude Perrault, 1670; Christiaan Huygens, 1692); thin-film interference colour; the dates from memory; pattern round 265
// Round:   265
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Twist=0..4, Tilt=24..64, Slide=0.4..3
//
// Knob 1: Hue. Where the film's colour path starts: a face turned to you is teal at 0 and a face turned edge on is rose, with azure, violet and magenta between, and patches of film push each LED along it, so the spire is never one colour. At 0.5 the path starts at rose and runs on through a quick pass of warm colours and lime to teal; the warm colours go by fast because they read brown when dim.
// Knob 2: Twist. The b of the surface. It is 0 to 0.03 at 0, Beltrami's straight pseudosphere, and between 0.05 and 0.22 where it opens (2), when one turn of the rim's helix climbs 0.3 to 1.4 units, 10 to 43 LEDs. At 4 it is between 0.10 and 0.24 and the surface lies open as a spiral ramp with a sail of sheet to one side. On every setting b swells and slackens by itself, on beats of 61, 181 and 37 seconds.
// Knob 3: Tilt. How far the camera looks down on the spire, 24 degrees where it opens, so the rim is an ellipse 25 LEDs tall, to 64, where the rim is a disc 72 LEDs across, a few LEDs wider than the panel, and the tip points at you. The camera nods 8 degrees either way on beats of 43 and 127 seconds and leans up to 3.7 degrees on beats of 29 and 73.
// Knob 4: Slide. How fast the grooves turn round the surface and the film climbs it. At 0.4, where it opens, the grooves go once round in 40 seconds and the film climbs 0.9 LED a second; at 3 it is 5 seconds a turn and 27 LEDs a second, since the film's speed rises with the square.

const W = 64, H = 128, N = W * H;
const { floor, ceil, max, min, abs, sqrt, sin, cos, tan, exp, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const frac = (v) => v - floor(v);

// The surface, with the horn parameter t in place of Dini's v (tan(v/2) = e^t):
//   x = sech t cos u,  y = sech t sin u,  z = t - tanh t + b u.
// t = 0 is the cuspidal edge, a rim of radius 1, and the tail runs up to a
// point as t grows. The arc length down the horn is ln cosh t, so rows of
// even arc length are rows of even steps on the panel.
// Its normal is (tanh t cos u + b sin u, tanh t sin u - b cos u, sech t) over
// sqrt(1 + b^2) at every b, and the Gauss curvature is -1 / (1 + b^2).
const EPS = 1.0; // LEDs between samples on the surface
const SMAX = 31.5; // LEDs per unit, at most: the rim is 63 wide
const RMIN = 0.5; // the tail is cut where its radius comes to this many LEDs
const UMAX = 12 * TAU;
const TH0 = 1.9; // where the sheet ends round the axis, 0 to the right and a quarter turn behind
const MINC = 14; // the fewest LEDs a drawn piece of the surface may have
const TOL = 0.15; // two LEDs whose depths differ by more than this are on different sheets
const EXPOSE = 110; // the mean of the brightest channel over the spire
const GLOW_R = 6; // half width of the halo's blur, in LEDs
const GLOW = 2.4; // the halo's gain
const NG = 18; // grooves of constant u round the horn
const FW = 0.3, FH = 0.34, NX = 10, NZ = 18; // the film: patches 0.3 across and 0.34 high, ten across the horn and 18 up it, round to the foot again
const FX0 = -1.5, FZ0 = -1.7; // the corner of the field, in the surface's own units
const FTAU = 12, FSIG = 0.2; // how long a patch of film lasts, in seconds, and how hard it is pushed
const DG = 0.34; // arc length between grooves of constant t

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The colour path, x in turns: from teal through azure, violet and magenta
// to rose takes most of the turn, and the warm colours and lime go by in a
// twelfth of it, since they read brown and olive when dim.
const PX = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.7, 0.74, 0.77, 0.8, 0.9, 1];
const PH = [0.49, 0.575, 0.67, 0.78, 0.86, 0.95, 1.02, 1.09, 1.17, 1.27, 1.38, 1.49];
function path(x) {
  x = frac(x);
  let i = 0;
  while (i < PX.length - 2 && x > PX[i + 1]) i++;
  return PH[i] + ((PH[i + 1] - PH[i]) * (x - PX[i])) / (PX[i + 1] - PX[i]);
}

// The film: a field of thickness laid on the surface from the front, in
// patches about as big as a block of 8 x 8 LEDs, each wandering on its own and
// all carried slowly up the horn, so the colour of the spire is never twice
// the same.
function film(s, d, rate) {
  const { fld } = s;
  const sg = FSIG * sqrt(d);
  for (let k = 0; k < 2 * NZ * NX; k++) fld[k] += -d * fld[k] / FTAU + sg * (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  // Carried up: the field is read lower and lower, and wraps after 21 rows.
  s.off += d * rate;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = { T: 0, phi: 0, gain: 1, off: 0, hue: 0, tw: 0.5, tilt: 24, slide: 0.4, zb: F(N), pu: F(N), pt: F(N), px: F(N), py: F(N), fr: F(N * 3), ga: F(N * 3), gb: F(N * 3), fld: F(2 * NZ * NX), keep: new Uint8Array(N), stack: new Int32Array(N) };
  // The film has been flowing up the horn for a while before the first frame.
  for (let k = 0; k < 300; k++) film(params.s, 0.2, 0.3);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 24, 0.4], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  s.tw = cl(k[1], 0, 4) / 4;
  s.tilt = cl(k[2], 24, 64);
  s.slide = cl(k[3], 0.4, 3);
  s.T += d;
  film(s, d, 0.04 + 0.28 * s.slide * s.slide);
  // The turn is not even: its rate rides on two slow beats, so no pair of
  // moments a fixed time apart finds the surface at the same angle.
  s.phi = (s.phi + d * s.slide * 0.4 * (1 + 0.45 * sin(0.0556 * s.T) + 0.25 * sin(0.0261 * s.T + 1.3))) % TAU;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const T = s.T;
  // b swells and falls on three slow beats that do not divide each other;
  // the camera nods on two.
  const w = cl(s.tw * (1 + 0.3 * sin(0.103 * T + 0.9) + 0.2 * sin(0.0347 * T + 2.6) + 0.08 * sin(0.17 * T + 1.7)) + 0.09 * (1 + 0.8 * sin(0.0319 * T + 4.1)), 0, 1);
  const b = 0.24 * pow(w, 1.15);
  const e = ((s.tilt + 5 * sin(0.1461 * T + 0.3) + 3 * sin(0.0495 * T + 5.0)) * PI) / 180, sE = sin(e), cE = cos(e);
  // The camera leans a few degrees about the line of sight, so the spire sways on its base.
  const roll = ((2.5 * sin(0.2167 * T + 1.1) + 1.2 * sin(0.0861 * T + 4.2)) * PI) / 180, sR = sin(roll), cR = cos(roll);
  const Rx = cR, Ry = sR * sE, Rz = sR * cE, Ux = -sR, Uy = cR * sE, Uz = cR * cE;
  // The film's thickness drifts, so the whole surface slides along its palette; the lamp swings.
  const shimmer = 0.06 * sin(0.1337 * T + 1.0) + 0.04 * sin(0.0622 * T + 3.1), hs = 0.06 * (1 + sin(0.04 * T - 1.6)) + 0.02 * (1 + sin(0.0938 * T - 1.7)), swing = 0.4 * sin(0.1186 * T + 2.0) + 0.2 * sin(0.0319 * T + 0.5);
  const phi = s.phi;

  // The fit: the rim's near point on row 125, the tip near the top, and the
  // rim no wider than the panel.
  const tEnd = (S) => log(S / RMIN + sqrt((S / RMIN) ** 2 - 1));
  const tipH = (S) => {
    const t = tEnd(S);
    return t - Math.tanh(t);
  };
  // Looking down from far above, the rim may be a little wider than the panel.
  const cap = SMAX + 6 * sm(0.7, 1.12, e);
  let S = cap;
  S = min(cap, 122 / (sE + tipH(S) * cE)) * (1 - 0.05 * (1 + sin(0.0795 * T + 2.7)) / 2);
  const CX = 32, CY = 125 - S * sE;
  const sEnd = log(cosh(tEnd(S))), ds = EPS / S, NR = floor(sEnd / ds) + 1;
  // The lowest world z that can fall on the panel, for the deeper turns.
  const zFloor = (CY - H - 3) / (S * cE) - tan(e) - 0.4;

  const { zb, pu, pt, px, py } = s;
  zb.fill(1e9);
  for (let i = 0; i < NR; i++) {
    const sa = i * ds, rho = exp(-sa), Tn = sqrt(max(0, 1 - rho * rho));
    const ep = exp(sa) + sqrt(max(0, exp(2 * sa) - 1)), tt = log(ep), hh = tt - Tn;
    const arc = sqrt(rho * rho + b * b) * S;
    const du = min(0.5, EPS / arc);
    // The last turn, and for the rows near the rim the turns below it.
    let uLo = -(TAU + 0.35);
    if (b > 0.004 && hh < 2 * TAU * b * 2.4) uLo = max(-UMAX, min(uLo, (zFloor - hh) / b));
    const n = ceil(-uLo / du), cd = cos(du), sd = sin(du), rs = rho * S < 1.6 ? 1.0 : 0.8, r2 = rs * rs;
    let c = cos(TH0), sn = sin(TH0);
    for (let kk = 0; kk <= n; kk++) {
      const u = -kk * du;
      const x = rho * c, y = rho * sn, z = hh + b * u;
      const sx = CX + S * (Rx * x + Ry * y + Rz * z), sy = CY - S * (Ux * x + Uy * y + Uz * z), dp = y * cE - z * sE;
      if (sx > -2 && sx < W + 2 && sy > -2 && sy < H + 2) {
        const x0 = max(0, ceil(sx - 0.5 - rs)), x1 = min(W - 1, floor(sx - 0.5 + rs));
        const y0 = max(0, ceil(sy - 0.5 - rs)), y1 = min(H - 1, floor(sy - 0.5 + rs));
        for (let yy = y0; yy <= y1; yy++) {
          const ey = yy + 0.5 - sy;
          for (let xx = x0; xx <= x1; xx++) {
            const ex = xx + 0.5 - sx;
            if (ex * ex + ey * ey > r2) continue;
            const q = yy * W + xx;
            if (dp < zb[q]) {
              zb[q] = dp;
              pu[q] = u;
              pt[q] = tt;
              px[q] = sx;
              py[q] = sy;
            }
          }
        }
      }
      const c2 = c * cd + sn * sd;
      sn = sn * cd - c * sd;
      c = c2;
    }
  }

  // Shade every lit LED from the surface point its sample stood for, moved
  // to the LED's own centre along the surface, so grooves are crisp.
  const lx = -0.5 + 0.3 * swing, ly = 0.62 + 0.2 * sin(0.0706 * T + 0.8), lz = -0.6, ln = 1 / sqrt(lx * lx + ly * ly + lz * lz);
  const Lx = lx * ln, Ly = ly * ln, Lz = lz * ln;
  let hx = Lx, hy = Ly, hz = Lz - 1;
  const hn = 1 / sqrt(hx * hx + hy * hy + hz * hz);
  hx *= hn;
  hy *= hn;
  hz *= hn;
  const nk = 1 / sqrt(1 + b * b), rgb = [0, 0, 0], { fr, ga, gb, fld } = s;
  tidy(s);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, o = q * 3;
      if (!s.keep[q]) {
        fr[o] = fr[o + 1] = fr[o + 2] = -1;
        continue;
      }
      let u = pu[q], t = pt[q];
      let th = u + TH0, c = cos(th), sn = sin(th), ep = exp(t), em = 1 / ep, rho = 2 / (ep + em), Tn = (ep - em) / (ep + em);
      // The surface's tangents, d/du and d/dt, on the panel.
      const ax = -rho * sn, ay = rho * c, bx = -rho * Tn * c, by = -rho * Tn * sn, bz = Tn * Tn;
      const pux = S * (Rx * ax + Ry * ay + Rz * b), puy = -S * (Ux * ax + Uy * ay + Uz * b);
      const ptx = S * (Rx * bx + Ry * by + Rz * bz), pty = -S * (Ux * bx + Uy * by + Uz * bz);
      const det = pux * pty - puy * ptx;
      if (abs(det) > 0.04 * sqrt((pux * pux + puy * puy) * (ptx * ptx + pty * pty))) {
        const dx = x + 0.5 - px[q], dy = y + 0.5 - py[q];
        const mu = min(0.5, EPS / (S * sqrt(rho * rho + b * b))), mt = EPS / (S * max(Tn, 0.05));
        u += cl((dx * pty - dy * ptx) / det, -mu, mu);
        t = max(0, t + cl((pux * dy - puy * dx) / det, -mt, mt));
        th = u + TH0;
        c = cos(th);
        sn = sin(th);
        ep = exp(t);
        em = 1 / ep;
        rho = 2 / (ep + em);
        Tn = (ep - em) / (ep + em);
      }
      // The normal, in the camera's frame: right, up, and away.
      const nx = (Tn * c + b * sn) * nk, ny = (Tn * sn - b * c) * nk, nz = rho * nk;
      let nr = Rx * nx + Ry * ny + Rz * nz, nu = Ux * nx + Uy * ny + Uz * nz, nd = ny * cE - nz * sE;
      let back = 0;
      if (nd > 0) (nr = -nr), (nu = -nu), (nd = -nd), (back = 1);
      const f = -nd;
      const diff = min(1, max(0, nr * Lx + nu * Ly + nd * Lz) + 0.3 * max(0, 0.7 * nr + 0.2 * nu - 0.68 * nd));
      const sp = 0.45 * pow(max(0, nr * hx + nu * hy + nd * hz), 70);
      const sArc = log((ep + em) / 2), ut = u - phi;
      const fx = cl((rho * c - FX0) / FW, 0, NX - 1.001), fq = (t - Tn + b * u - FZ0) / FH - s.off, fz = fq - NZ * floor(fq / NZ);
      const j0 = floor(fx), i0 = floor(fz), i1 = (i0 + 1) % NZ, aj = fx - j0, ai = fz - i0;
      const fv = (fld[i0 * NX + j0] * (1 - aj) + fld[i0 * NX + j0 + 1] * aj) * (1 - ai) + (fld[i1 * NX + j0] * (1 - aj) + fld[i1 * NX + j0 + 1] * aj) * ai;
      // A second field, on its own, for how bright the film is.
      const fq2 = fq * 0.8 + 3.1, fz2 = fq2 - NZ * floor(fq2 / NZ), k0 = NZ * NX + floor(fz2) * NX, k1 = NZ * NX + ((floor(fz2) + 1) % NZ) * NX, bj = fz2 - floor(fz2);
      const fb = (fld[k0 + j0] * (1 - aj) + fld[k0 + j0 + 1] * aj) * (1 - bj) + (fld[k1 + j0] * (1 - aj) + fld[k1 + j0 + 1] * aj) * bj;
      const pr = 0.12 + 0.6 * pow(1 - f, 0.85) + back * 0.1 + shimmer + hs + 1.6 * fv, p = 0.5 + 0.55 * Math.tanh(1.8 * (pr - 0.5));
      const px0 = s.hue + 0.6 * p, warm = sm(0.6, 0.7, frac(px0)) * (1 - sm(0.84, 0.92, frac(px0)));
      hsv(path(px0), 0.66 - 0.4 * sp - 0.18 * warm, 1, rgb);
      let val = (0.12 + 0.72 * pow(diff, 1.1)) * (0.1 + 0.9 * pow(f, 0.55));
      // What the surface mirrors: a soft box overhead and a pale line near the
      // horizon, seen more strongly the more edge on the surface is.
      const ru = 2 * f * nu, env = 0.1 + 0.9 * sm(0.3, 0.95, ru) + 0.45 * exp(-(((ru - 0.05) / 0.14) ** 2)), mirror = (0.1 + 0.9 * pow(1 - f, 3)) * env;
      // Where the film is thick the light is stronger.
      val *= 0.55 + 0.9 * cl(0.5 + 0.9 * fb, 0, 1);
      // Thin the tip out: it is under two LEDs round there.
      val *= 0.5 + 0.5 * sm(RMIN, 2.6, rho * S);
      // The grooves, lines of constant u and of constant t, each about an
      // LED wide on the panel wherever they are far enough apart to read.
      const len = sqrt(ptx * ptx + pty * pty) + 1e-6, len2 = sqrt(pux * pux + puy * puy) + 1e-6, cr = abs(pux * pty - puy * ptx);
      const du = TAU / NG, gu = abs(frac(ut / du + 0.5) - 0.5) * du;
      const dU = (gu * cr) / len, spU = (du * cr) / len;
      const gt = abs(frac(sArc / DG + 0.5) - 0.5) * DG, tn = max(Tn, 0.03);
      const dT = (gt * cr) / (len2 * tn), spT = (DG * cr) / (len2 * tn);
      const gU = (1 - sm(0.3, 1.0, dU)) * sm(4, 8, spU), gT = (1 - sm(0.3, 1.0, dT)) * sm(4, 8, spT) * sm(2.5, 5, rho * S);
      val *= 1 - 0.75 * max(gU, gT);
      const gl = sp + 0.5 * mirror * val;
      fr[o] = 255 * (rgb[0] * (val + 0.6 * mirror * val) + gl * 0.6);
      fr[o + 1] = 255 * (rgb[1] * (val + 0.6 * mirror * val) + gl * 0.6);
      fr[o + 2] = 255 * (rgb[2] * (val + 0.6 * mirror * val) + gl * 0.6);
    }
  prune(s);
  // The exposure follows the picture, so the spire is as bright whichever way
  // the lamp and the film turn it; the gain eases over a second or two.
  let tot = 0, cnt = 0;
  for (let q = 0; q < N; q++) if (fr[q * 3] >= 0) (tot += max(fr[q * 3], fr[q * 3 + 1], fr[q * 3 + 2])), cnt++;
  if (cnt > 40) s.gain += (cl(EXPOSE / (tot / cnt), 0.6, 1.8) - s.gain) * 0.04;
  const gain = s.gain;
  for (let q = 0; q < N * 3; q++) if (fr[q] >= 0) fr[q] *= gain;
  // A faint halo: the body blurred twice, laid round it.
  blur(fr, ga, 0);
  blur(ga, gb, 1);
  blur(gb, ga, 0);
  blur(ga, gb, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (fr[o] < 0) display.setPixel(x, y, min(255, gb[o] * GLOW), min(255, gb[o + 1] * GLOW), min(255, gb[o + 2] * GLOW));
      else display.setPixel(x, y, min(255, fr[o]), min(255, fr[o + 1]), min(255, fr[o + 2]));
    }
}

// A lit LED that is in no 2 x 2 square of LEDs on one sheet is a sliver where
// a sheet shows its edge past another, or a stray dot. On the panel it reads
// as a dotted line of dirt, and it is left out.
function thin(zb, x, y) {
  const d = zb[y * W + x];
  for (let oy = -1; oy <= 0; oy++)
    for (let ox = -1; ox <= 0; ox++) {
      const x0 = x + ox, y0 = y + oy;
      if (x0 < 0 || y0 < 0 || x0 + 1 >= W || y0 + 1 >= H) continue;
      const q = y0 * W + x0;
      if (abs(zb[q] - d) < TOL && abs(zb[q + 1] - d) < TOL && abs(zb[q + W] - d) < TOL && abs(zb[q + W + 1] - d) < TOL) return false;
    }
  return true;
}

// Which LEDs are drawn: those on a sheet at least two LEDs wide.
function tidy(s) {
  const { zb, keep } = s;
  for (let y = 0, q = 0; y < H; y++) for (let x = 0; x < W; x++, q++) keep[q] = zb[q] < 1e8 && !thin(zb, x, y) ? 1 : 0;
}

// Then, once shaded, any piece of fewer than MINC LEDs that the panel really
// shows (a channel of 32 or more) and that touches nothing else it shows is
// left out: a fleck of a sheet's edge, not part of the picture.
function prune(s) {
  const { fr, keep, stack } = s;
  for (let q = 0; q < N; q++) keep[q] = fr[q * 3] >= 0 && max(fr[q * 3], fr[q * 3 + 1], fr[q * 3 + 2]) >= 32 ? 1 : 0;
  for (let q0 = 0; q0 < N; q0++) {
    if (keep[q0] !== 1) continue;
    let n = 0, top = 0;
    stack[top++] = q0;
    keep[q0] = 2;
    while (top > 0) {
      const q = stack[--top], x = q % W, y = (q - x) / W;
      stack[N - 1 - n++] = q;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const r = yy * W + xx;
          if (keep[r] === 1) (keep[r] = 2), (stack[top++] = r);
        }
    }
    const small = n < MINC;
    for (let i = 0; i < n; i++) {
      const q = stack[N - 1 - i];
      keep[q] = 3;
      if (small) fr[q * 3] = fr[q * 3 + 1] = fr[q * 3 + 2] = -1;
    }
  }
}

// A box blur of half width GLOW_R along rows (vertical 0) or columns (1),
// the empty LEDs, marked -1, counting as dark.
function blur(src, dst, vertical) {
  const R = GLOW_R, len = vertical ? H : W, lines = vertical ? W : H, step = vertical ? W * 3 : 3, lineStep = vertical ? 3 : W * 3, inv = 1 / (2 * R + 1);
  for (let l = 0; l < lines; l++)
    for (let ch = 0; ch < 3; ch++) {
      const base = l * lineStep + ch;
      let acc = 0;
      for (let i = -R; i < len + R; i++) {
        const ia = i + R, ir = i - R - 1;
        if (ia < len) acc += max(0, src[base + ia * step]);
        if (ir >= 0) acc -= max(0, src[base + ir * step]);
        if (i >= 0 && i < len) dst[base + i * step] = acc * inv;
      }
    }
}

function cosh(v) {
  return 0.5 * (exp(v) + exp(-v));
}
