// ===== Patternflow pattern =====
// Title:   Luneburg Relay
// Family:  gradientindex
// Idea:    Three coloured beams of parallel rays cross two Luneburg lenses that touch, one above the other, each beam bending to a point on the rim opposite the side it came in and the lower lens turning the fan from that point back into parallel rays, so that as the headings wander the relay now and then locks on the touching point, burns white there and sends a sheaf out of the bottom, then slides away and the focus travels round a rim.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Luneburg lens (Rudolf Luneburg, lectures on optics at Brown University, 1944, printed as Mathematical Theory of Optics, from memory), whose index sqrt(2 - r^2/R^2) brings a parallel beam to a point on the rim, and its cousin Maxwell's fish-eye (James Clerk Maxwell, 1854); two of them touching as a relay is this pattern's own arrangement; pattern round 232
// Round:   232
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wander=0.2..4, Aperture=-1..1, Detune=-1..1
//
// Knob 1: Hue. Turns the three beams round the colour wheel together, gold, cyan and magenta at 0 and again at 1; across each beam the hue also runs 28 degrees from one edge to the other, and each drifts a few degrees on its own.
// Knob 2: Wander. How fast the beams' headings, positions and brightness drift: a tenth of the opening speed at 0.2, twice it at 4.
// Knob 3: Aperture. How wide the beams are. The gold beam is 7 LED across at -1 and carries 7 rays, 27 LED and 15 rays at 0, 61 LED and 34 rays at 1, the cyan and magenta beams four fifths and two thirds of that.
// Knob 4: Detune. The index profile n = sqrt(1 + s (1 - r^2/R^2)) with s = 1 + 0.5 (K4 - 0.06): the true Luneburg lens at the opening 0.06; at -1 (s = 0.47) the rays leave short of the rim and focus outside the lens, at 1 (s = 1.47) they cross inside it and the beam folds into a caustic.

// A ray in a medium of index n(r) follows d/ds (n dr/ds) = grad n. In the parameter dtau = ds / n that
// reads r'' = grad(n^2) / 2, and for n^2 = 1 + s (1 - r^2/R^2) inside a disc that is r'' = -s r / R^2: a
// harmonic oscillator. Inside a lens every ray is therefore an exact ellipse, and the code rotates it
// instead of stepping it. A scratch check against RK4 at 0.01 LED agrees on the exit point and direction
// to three decimals for s = 0.47, 1 and 1.47. The index is 1 on the rim whatever s is, so a ray goes in
// and out of the glass with no reflection and no kink. At s = 1 every ray of a parallel beam leaves
// at the same rim point R times the beam's heading away from the centre.

const W = 64;
const H = 128;
const N = W * H;
const { floor, ceil, sqrt, cos, sin, exp, abs, max, min, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the two lenses, touching at (32, 64)
const R = 31;
const LX = [32, 32];
const LY = [33, 95];

// ---- how a ray is drawn: a compact bell 1.6 LED in radius, 1.7 LED across at half height
const KR = 1.6;
const KR2 = KR * KR;
const KNORM = 15 / (16 * KR); // one over the line integral of (1 - d^2 / KR^2)^2
const DS = 0.6; // LED between samples along a ray

// ---- the beams: base heading (radians, y down), sums of sines in wander time, a lateral shift of the aim point
const BEAMS = [
  { hue: 52, sat: 0.6, lens: 0, base: PI / 2, amp: [0.62, 0.34, 0.12], w: [0.074, 0.11, 0.277], ph: [0.9, 2.1, 4.0], oa: [15, 8], ow: [0.088, 0.22], op: [1.3, 3.7], wid: 1.0, ew: [0.046, 0.109], ep: [0.4, 2.8], vw: [0.074, 0.148], vp: [1.9, 4.6], hv: [0.038, 0.096], hp: [0.7, 3.1], hd: 7, spread: 14 },
  { hue: 186, sat: 0.7, lens: 1, base: -1.15, amp: [0.75, 0.3, 0.1], w: [0.075, 0.16, 0.224], ph: [2.4, 0.5, 5.1], oa: [14, 7], ow: [0.108, 0.137], op: [4.4, 0.8], wid: 0.8, ew: [0.041, 0.075], ep: [3.6, 1.1], vw: [0.072, 0.147], vp: [5.0, 0.3], hv: [0.045, 0.127], hp: [4.1, 1.4], hd: 12, spread: 14 },
  { hue: 316, sat: 0.62, lens: 0, base: 2.0, amp: [0.6, 0.33, 0.13], w: [0.09, 0.106, 0.173], ph: [5.5, 3.3, 1.7], oa: [14, 8], ow: [0.152, 0.236], op: [2.2, 5.9], wid: 0.65, ew: [0.044, 0.101], ep: [5.2, 4.4], vw: [0.056, 0.182], vp: [3.2, 2.2], hv: [0.029, 0.088], hp: [2.5, 5.3], hd: 12, spread: 14 },
];

const hsv = (h, s, v) => {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
};

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

export function setup(P) {
  P.acc = new Float32Array(N * 3);
  P.rr = new Float32Array(N * 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let k = 0; k < 2; k++) {
        const dx = x + 0.5 - LX[k];
        const dy = y + 0.5 - LY[k];
        P.rr[i * 2 + k] = sqrt(dx * dx + dy * dy);
      }
    }
  P.T = 0;
  P.ou = new Float32Array(BEAMS.length);
  P.hueK = 0;
  P.aperture = 0;
  P.s = 1;
  P.ang = new Float32Array(BEAMS.length);
  P.env = new Float32Array(BEAMS.length);
  P.wm = new Float32Array(BEAMS.length);
  P.hm = new Float32Array(BEAMS.length);
  P.shift = new Float32Array(BEAMS.length);
  aim(P);
}

// Where each beam points and where it is aimed, from the wander clock.
function aim(P) {
  for (let b = 0; b < BEAMS.length; b++) {
    const B = BEAMS[b];
    let a = B.base + P.ou[b];
    for (let j = 0; j < 3; j++) a += B.amp[j] * sin(B.w[j] * P.T + B.ph[j]);
    let o = 0;
    for (let j = 0; j < 2; j++) o += B.oa[j] * sin(B.ow[j] * P.T + B.op[j]);
    P.ang[b] = a;
    P.shift[b] = o;
    // how strongly the beam is lit: each one swells and sinks on its own slow clock, never all three low at once
    const e = sin(B.ew[0] * P.T + B.ep[0]) + 0.6 * sin(B.ew[1] * P.T + B.ep[1]);
    P.env[b] = 0.15 + 0.85 * sm(-1.5, 1.5, e);
    // and how wide it is, and how far its colour has drifted from where it started
    P.wm[b] = 1 + 0.42 * sin(B.vw[0] * P.T + B.vp[0]) + 0.18 * sin(B.vw[1] * P.T + B.vp[1]);
    P.hm[b] = B.hd * (sin(B.hv[0] * P.T + B.hp[0]) + 0.4 * sin(B.hv[1] * P.T + B.hp[1]));
  }
}

export function update(dt, input, P) {
  if (!P.acc) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const rate = (cl(k[1], 0.2, 4) / 2) * 1.35;
  const dr = d * rate;
  P.T += dr;
  for (let b = 0; b < BEAMS.length; b++) P.ou[b] += (-P.ou[b] / 60) * dr + 0.0361 * sqrt(dr) * gauss();
  P.hueK = cl(k[0], 0, 1);
  P.aperture = cl(k[2], -1, 1);
  P.s = 1 + 0.5 * (cl(k[3], -1, 1) - 0.06);
  aim(P);
}

// ---- drawing a ray

function deposit(acc, x, y, wgt, cr, cg, cb) {
  const x0 = max(0, ceil(x - 0.5 - KR));
  const x1 = min(W - 1, floor(x - 0.5 + KR));
  const y0 = max(0, ceil(y - 0.5 - KR));
  const y1 = min(H - 1, floor(y - 0.5 + KR));
  for (let iy = y0; iy <= y1; iy++) {
    const dy = iy + 0.5 - y;
    for (let ix = x0; ix <= x1; ix++) {
      const dx = ix + 0.5 - x;
      const d2 = dx * dx + dy * dy;
      if (d2 >= KR2) continue;
      const t = 1 - d2 / KR2;
      const f = t * t * wgt * KNORM;
      const o = (iy * W + ix) * 3;
      acc[o] += f * cr;
      acc[o + 1] += f * cg;
      acc[o + 2] += f * cb;
    }
  }
}

// A straight run from (px, py) along (dx, dy), from t = ta to tb, clipped to the panel and a margin.
function straight(acc, px, py, dx, dy, ta, tb, wgt, cr, cg, cb, mode) {
  const M = KR + 1;
  let t0 = ta;
  let t1 = tb;
  if (abs(dx) < 1e-9) {
    if (px < -M || px > W + M) return;
  } else {
    const a = (-M - px) / dx;
    const b = (W + M - px) / dx;
    t0 = max(t0, min(a, b));
    t1 = min(t1, max(a, b));
  }
  if (abs(dy) < 1e-9) {
    if (py < -M || py > H + M) return;
  } else {
    const a = (-M - py) / dy;
    const b = (H + M - py) / dy;
    t0 = max(t0, min(a, b));
    t1 = min(t1, max(a, b));
  }
  if (t1 <= t0) return;
  const n = ceil((t1 - t0) / DS);
  const st = (t1 - t0) / n;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i + 0.5) * st;
    // outside the glass a ray is faint, and fainter the further it is from the lens it left or is heading for
    const near = mode === 0 ? 1e9 : mode === 1 ? t - ta : mode === -1 ? tb - t : min(t - ta, tb - t);
    const f = OUT0 + (1 - OUT0) * exp(-near / LEAD);
    deposit(acc, px + dx * t, py + dy * t, wgt * st * f, cr, cg, cb);
  }
}

// Which lens a straight run meets first: -1 for none, else the lens and the distance to its rim.
function nextLens(px, py, dx, dy, skip, out) {
  let best = 1e9;
  let which = -1;
  for (let k = 0; k < 2; k++) {
    if (k === skip) continue;
    const ox = px - LX[k];
    const oy = py - LY[k];
    const b = ox * dx + oy * dy;
    const c = ox * ox + oy * oy - R * R;
    const disc = b * b - c;
    if (disc <= 0) continue;
    const t = -b - sqrt(disc);
    if (t > -1e-6 && t < best) {
      best = t;
      which = k;
    }
  }
  out[0] = which;
  out[1] = best < 0 ? 0 : best;
}

const hit = [0, 0];
const OUT0 = 0.1;
const LEAD = 8;

// One ray, from far outside along (dx, dy): straight until a lens, an exact ellipse inside it, straight again.
function ray(P, px, py, dx, dy, wgt, cr, cg, cb) {
  const acc = P.acc;
  const s = P.s;
  const om = sqrt(s) / R;
  let skip = -1;
  for (let leg = 0; leg < 8; leg++) {
    nextLens(px, py, dx, dy, skip, hit);
    const k = hit[0];
    if (k < 0) {
      straight(acc, px, py, dx, dy, 0, 1000, wgt, cr, cg, cb, leg > 0 ? 1 : 0);
      return;
    }
    straight(acc, px, py, dx, dy, 0, hit[1], wgt, cr, cg, cb, leg > 0 ? 2 : -1);
    // enter at the rim: the index is 1 there whatever s is, so the ray neither reflects nor refracts
    let qx = px + dx * hit[1] - LX[k];
    let qy = py + dy * hit[1] - LY[k];
    const rq = sqrt(qx * qx + qy * qy);
    qx *= R / rq;
    qy *= R / rq;
    // in the parameter dtau = ds / n the ray equation reads r'' = grad(n^2) / 2 = -s r / R^2, a harmonic oscillator
    let ux = dx / om;
    let uy = dy / om;
    const c0 = qx * ux + qy * uy;
    // |q|^2 = R^2 again where tan(theta) = 2 c0 / (R^2 (1 - 1/s))
    const a = R * R * (1 - 1 / s);
    let th;
    if (c0 > -1e-9) th = a >= 0 ? PI : 0;
    else {
      th = atan2(2 * c0, a);
      if (th <= 1e-9) th += PI;
    }
    if (th < 1e-6) {
      // grazing and leaving at once
      px = LX[k] + qx;
      py = LY[k] + qy;
      skip = k;
      continue;
    }
    const nav = 1 + 0.5 * (sqrt(1 + s) - 1);
    const steps = max(2, ceil((th / om) * nav / DS));
    const dth = th / steps;
    const cd = cos(dth);
    const sd = sin(dth);
    let ox = qx;
    let oy = qy;
    for (let i = 0; i < steps; i++) {
      const nx = qx * cd + ux * sd;
      const ny = qy * cd + uy * sd;
      const vx = -qx * sd + ux * cd;
      const vy = -qy * sd + uy * cd;
      qx = nx;
      qy = ny;
      ux = vx;
      uy = vy;
      const ex = qx - ox;
      const ey = qy - oy;
      deposit(acc, LX[k] + (qx + ox) * 0.5, LY[k] + (qy + oy) * 0.5, wgt * sqrt(ex * ex + ey * ey), cr, cg, cb);
      ox = qx;
      oy = qy;
    }
    const sp = sqrt(ux * ux + uy * uy);
    dx = ux / sp;
    dy = uy / sp;
    px = LX[k] + qx;
    py = LY[k] + qy;
    skip = k;
  }
}

// ---- the picture

export function draw(display, P) {
  if (!P.acc) setup(P);
  const acc = P.acc;
  acc.fill(0);
  const ap = P.aperture;
  const width = ap < 0 ? 27 * 0.25 ** -ap : 27 * (1 + 1.25 * ap);
  const gap = 1.8;
  for (let b = 0; b < BEAMS.length; b++) {
    const B = BEAMS[b];
    const wd = width * B.wid * P.wm[b];
    const n = max(7, Math.round(wd / gap));
    const wgt = 2.1 * P.env[b] * (width > 27 ? (27 / width) ** 0.5 : 1);
    const ang = P.ang[b];
    const dx = cos(ang);
    const dy = sin(ang);
    const nx = -dy;
    const ny = dx;
    const ax = LX[B.lens] + nx * P.shift[b];
    const ay = LY[B.lens] + ny * P.shift[b];
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1) - 0.5) * 2;
      const col = hsv(B.hue + P.hm[b] + P.hueK * 360 + B.spread * u, B.sat, 1);
      const off = u * wd * 0.5;
      ray(P, ax + nx * off - dx * 150, ay + ny * off - dy * 150, dx, dy, wgt * exp(-2.6 * u * u * u * u), col[0], col[1], col[2]);
    }
  }

  // the lenses themselves: a faint glow that follows the index, and a thin rim
  const s = P.s;
  const gc = hsv(235 + P.hueK * 360, 0.4, 1);
  for (let i = 0; i < N; i++) {
    let lev = 0;
    for (let k = 0; k < 2; k++) {
      const r = P.rr[i * 2 + k];
      if (r < R + 1.5) {
        const rho = r / R;
        if (rho < 1) lev += (sqrt(1 + s * (1 - rho * rho)) - 1) * 0.55;
        const e = (r - (R - 0.5)) / 0.9;
        lev += 0.2 * exp(-e * e);
      }
    }
    const gl = lev * 0.6;
    let m = max(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]);
    let cr = 0;
    let cg = 0;
    let cb = 0;
    if (m > 1e-5) {
      const v = (m ** 0.72 * (1 + m / 12)) / (1 + m ** 0.72);
      const w = sm(2.5, 12, m) * 0.85;
      const k = v / m;
      cr = (acc[i * 3] * k) * (1 - w) + v * w;
      cg = (acc[i * 3 + 1] * k) * (1 - w) + v * w;
      cb = (acc[i * 3 + 2] * k) * (1 - w) + v * w;
    }
    cr = 1 - (1 - min(1, cr)) * (1 - gl * gc[0]);
    cg = 1 - (1 - min(1, cg)) * (1 - gl * gc[1]);
    cb = 1 - (1 - min(1, cb)) * (1 - gl * gc[2]);
    display.setPixel(i % W, floor(i / W), floor(cr * 255 + 0.5), floor(cg * 255 + 0.5), floor(cb * 255 + 0.5));
  }
}
