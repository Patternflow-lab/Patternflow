// ===== Patternflow pattern =====
// Title:   Grover Search
// Family:  grover
// Idea:    Two circles, each a radial plot of the 128 amplitudes of its own Grover search, a ring of gold that deflates as the oracle drops the marked spokes inside it and the diffusion throws them out into a few long needles, until a measurement collapses the ring to one flashing spoke and it inflates again to a new search, the two circles never in step.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Grover's search algorithm (Lov Grover 1996, "A fast quantum mechanical algorithm for database search"), amplitude amplification as an oracle that flips the sign of the marked states followed by a reflection of every amplitude about the mean, a rotation by 2 theta an iteration with sin(theta) = sqrt(M/N) and the optimum near pi/4 sqrt(N/M) iterations, overcooking past it (from memory); the radial plot, the radius map, the afterimage rings, the noise model and the colours are original, pattern round 245
// Round:   245
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..4, Targets=-1..1, Noise=0..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the positive amplitudes are gold and amber and the negative ones cyan and violet, with a pale white where an amplitude crosses zero; each circle's gold and cyan also wander a few degrees on their own slow periods.
// Knob 2: Rate. 0 to 4, opening at 2. Search iterations a second, as a smooth exponential: 0.6 at 0, 2 at 2 and 6.5 at 4. The collapse and the re-inflation scale with it. At 0 a search of one marked spoke takes nearly half a minute and the needle is plainly still growing; at 4 the ring flickers through a search in under two seconds.
// Knob 3: Targets. -1 to 1, opening at 0. How many spokes are marked in each search, a whole number from 1 to 6. At -1 every search has one marked spoke and ends in one long needle. At 1 every search has six and ends in six shorter ones. In between a range of counts is drawn at random, 1 to 6 at the opening. Turning it while a search runs adds or removes marked spokes there and then.
// Knob 4: Noise. 0 to 1, opening at 0.06. Imperfection in the oracle and the diffusion: small random errors on every amplitude and, now and then, a marked spoke that is flipped by the wrong phase. At 0 the search is exact and the ring is smooth. Higher, the ring turns ragged, the needles stay lower and the picture strays off the clean rotation.

const W = 64, H = 128, N = 128, NM = N - 1;
const { floor, min, max, abs, exp, sqrt, sin, cos, asin, asinh, atan2, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);
const sstep = (x) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const SQN = sqrt(N);
const RB = 7, RP = 6.2, RN = 4.2;           // radius of b = 0, and the scales for positive and negative b, LED
const RMIN = 1.5, RMAX = 28.5;
const RU = RB + RP * asinh(1);              // the reference ring: the uniform superposition
const TI = 1.5;                             // seconds the ring takes to inflate again, at the opening rate
const TH = 0.24, TG = 0.04;                 // a half step, and the rest after it
const TC = 0.45, THOLD = 0.55;              // the collapse, and the hold on the one spoke
const CS = new Float32Array(N), SN = new Float32Array(N);
for (let i = 0; i < N; i++) {
  CS[i] = cos((TP * i) / N);
  SN[i] = sin((TP * i) / N);
}

// the stroke: a 2 LED core with a glow, as a table over the squared distance
const LUT = 256, EXT = 5.2, EXTG = 2.6;
const mkLut = (ext, sg, gw, gs) => {
  const t = new Float32Array(LUT), ls = (ext * ext) / (LUT - 1);
  for (let i = 0; i < LUT; i++) {
    const d2 = i * ls;
    t[i] = exp(-d2 / (2 * sg * sg)) + gw * exp(-d2 / (2 * gs * gs));
  }
  return t;
};
const LUTM = mkLut(EXT, 1.0, 0.26, 2.5), LUTG = mkLut(EXTG, 0.7, 0, 1);

function hsv(h, s, v, out, o) {
  h = fr(h) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  out[o] = m === 0 || m === 5 ? v : m === 1 ? q : m === 4 ? t : p;
  out[o + 1] = m === 1 || m === 2 ? v : m === 0 ? t : m === 3 ? q : p;
  out[o + 2] = m === 3 || m === 4 ? v : m === 2 ? t : m === 5 ? q : p;
}

const rmap = (b) => cl(b >= 0 ? RB + RP * asinh(b) : RB - RN * asinh(-b), RMIN, RMAX);

// ---- one search ---------------------------------------------------------------
function mkCircle() {
  const f = () => new Float32Array(N);
  return {
    a: f(), a0: f(), a1: f(), mark: new Uint8Array(N), bd: f(), M: 0,
    ph: 0, u: 0, iter: 0, fac: 1, spd: 1, ej: floor(rnd() * N), fl: 0,
    sn: [f(), f(), f(), f()], sage: [99, 99, 99, 99], sh: 0,
  };
}

// the marked count a knob setting allows: its whole numbers, from lo to hi
function band(k) {
  const c = 3.5 + 2.5 * k, sp = 2.5 * (1 - abs(k));
  return [cl(Math.ceil(c - sp - 1e-6), 1, 6), cl(floor(c + sp + 1e-6), 1, 6)];
}

function nearMark(mark, i) {
  for (let d = -3; d <= 3; d++) if (mark[(i + d + N) & NM]) return true;
  return false;
}

function setMarks(c, M) {
  const mk = c.mark;
  let n = 0;
  for (let i = 0; i < N; i++) n += mk[i];
  for (let tries = 0; n < M && tries < 600; tries++) {
    const i = floor(rnd() * N);
    if (mk[i] || nearMark(mk, i)) continue;
    mk[i] = 1;
    n++;
  }
  for (let tries = 0; n > M && tries < 2000; tries++) {
    const i = floor(rnd() * N);
    if (!mk[i]) continue;
    mk[i] = 0;
    n--;
  }
  c.M = n;
}

const optimum = (M) => max(1, PI / (4 * asin(sqrt(M / N))) - 0.5);

function norm(v) {
  let s = 0;
  for (let i = 0; i < N; i++) s += v[i] * v[i];
  s = 1 / sqrt(s || 1);
  for (let i = 0; i < N; i++) v[i] *= s;
}

function snap(c) {
  const s = c.sn[c.sh];
  for (let i = 0; i < N; i++) s[i] = c.a[i] * SQN;
  c.sage[c.sh] = 0;
  c.sh = (c.sh + 1) & 3;
}

function enter(st, c, ph) {
  c.ph = ph;
  c.u = 0;
  const k4 = cl(st.k[3], 0, 1), sig = k4 * 0.012;
  if (ph === 0) {
    // inflate to a new search: new marks, and how long this search will run
    c.mark.fill(0);
    const [lo, hi] = band(cl(st.k[2], -1, 1));
    setMarks(c, lo + floor(rnd() * (hi - lo + 1)));
    c.fac = rnd() < 0.12 ? 1.6 + 0.8 * rnd() : 0.7 + 0.7 * rnd();
    c.iter = 0;
    c.spd = 0.8 + 0.45 * rnd();
  } else if (ph === 1) {
    // the oracle: marked amplitudes change sign, one of them now and then by the wrong phase
    const [lo, hi] = band(cl(st.k[2], -1, 1));
    if (c.M < lo || c.M > hi) setMarks(c, cl(c.M, lo, hi));
    c.a0.set(c.a);
    const mk = c.mark;
    let bad = -1, phi = 0;
    if (c.M > 0 && rnd() < 1.2 * k4) {
      let n = floor(rnd() * c.M);
      for (let i = 0; i < N; i++) if (mk[i] && n-- === 0) bad = i;
      phi = rnd() * 2.2;
    }
    for (let i = 0; i < N; i++) {
      let v = c.a0[i];
      if (mk[i]) v *= i === bad ? -cos(phi) : -1;
      c.a1[i] = v + (sig > 0 ? gauss() * sig : 0);
    }
    norm(c.a1);
  } else if (ph === 3) {
    // the diffusion: every amplitude reflected about the mean
    c.a0.set(c.a);
    let m = 0;
    for (let i = 0; i < N; i++) m += c.a0[i];
    m = (2 * m) / N;
    for (let i = 0; i < N; i++) c.a1[i] = m - c.a0[i] + (sig > 0 ? gauss() * sig : 0);
    norm(c.a1);
  } else if (ph === 5) {
    // the measurement: a spoke drawn with the probability of its squared amplitude
    snap(c);
    c.a0.set(c.a);
    let tot = 0;
    for (let i = 0; i < N; i++) tot += c.a[i] * c.a[i];
    let r = rnd() * tot, j = N - 1;
    for (let i = 0; i < N; i++) {
      r -= c.a[i] * c.a[i];
      if (r <= 0) {
        j = i;
        break;
      }
    }
    c.ej = j;
    c.a1.fill(0);
    c.a1[j] = 1;
    c.fl = 1;
  }
}

function stepC(st, c, d) {
  d *= c.spd;
  c.u += d;
  for (let s = 0; s < 4; s++) c.sage[s] += d;
  c.fl *= exp(-d / 0.28);
  const kb = 1 - exp(-d / 0.2), show = (c.ph >= 1 && c.ph <= 4) || (c.ph === 0 && c.u > 0.55 * TI);
  for (let i = 0; i < N; i++) c.bd[i] += ((show && c.mark[i] ? 1 : 0) - c.bd[i]) * kb;
  const a = c.a;
  if (c.ph === 0) {
    const w = sstep(c.u / TI), s = 1 / SQN, nn = 1 / sqrt(NM * w * s * w * s + (w * s + 1 - w) * (w * s + 1 - w));
    a.fill(w * s * nn);
    a[c.ej] = (w * s + 1 - w) * nn;
    if (c.u >= TI) enter(st, c, 1);
  } else if (c.ph === 1 || c.ph === 3) {
    const e = sstep(c.u / TH);
    for (let i = 0; i < N; i++) a[i] = c.a0[i] + (c.a1[i] - c.a0[i]) * e;
    if (c.u >= TH + TG) {
      if (c.ph === 1) enter(st, c, 3);
      else {
        a.set(c.a1);
        c.iter++;
        snap(c);
        enter(st, c, c.iter >= max(2, Math.round(c.fac * optimum(c.M))) ? 5 : 1);
      }
    }
  } else if (c.ph === 5) {
    const e = sstep(c.u / TC);
    for (let i = 0; i < N; i++) a[i] = c.a0[i] + (c.a1[i] - c.a0[i]) * e;
    if (c.u >= TC + THOLD) enter(st, c, 0);
  }
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, rate: 2,
    fb: f(W * H * 3), cov: f(W * H), bv: f(W * H),
    px: f(N), py: f(N), rad: f(N), bb: f(N), gs: f(N), tab: f(241 * 3),
    c: [mkCircle(), mkCircle()],
    ph: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(() => rnd() * TP),
  });
  enter(st, st.c[0], 0);
  enter(st, st.c[1], 0);
  return st;
}

function sim(st, dt) {
  st.t += dt;
  const k = st.k;
  st.rate += (2 * Math.pow(1.8, cl(k[1], 0, 4) - 2) - st.rate) * (1 - exp(-dt / 0.25));
  const dc = (dt * st.rate) / 2, n = max(1, Math.ceil(dc / 0.05));
  for (let s = 0; s < n; s++) for (let ci = 0; ci < 2; ci++) stepC(st, st.c[ci], dc / n);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    st.rate = 2 * Math.pow(1.8, cl(st.k[1], 0, 4) - 2);
    const runs = [7 + 7 * rnd(), 15 + 10 * rnd()];
    for (let ci = 0; ci < 2; ci++) for (let s = 0; s < runs[ci] * 30; s++) stepC(st, st.c[ci], (1 / 30) * (st.rate / 2));
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt);
}

// ---- the picture --------------------------------------------------------------
// colour of an amplitude b (1 is the uniform ring): gold to amber for positive, cyan to violet for negative, pale white at zero
function buildTab(tab, hp, hn) {
  for (let q = 0; q <= 240; q++) {
    const b = (q - 120) / 10, ab = abs(b);
    const s = 0.12 + 0.76 * sstep(ab / 0.4), v = 0.82 + 0.18 * sstep(ab / 6);
    const h = b >= 0 ? hp - 0.04 * sstep((ab - 1.2) / 6.8) : hn + 0.1 * sstep((ab - 1.2) / 6.8);
    hsv(h, s, v, tab, q * 3);
  }
}

// the closed curve through the spoke tips, as the nearest-segment distance in the coverage buffer
function stroke(st, px, py, bb, lut, ext, gs) {
  const { cov, bv } = st, e2 = ext * ext, ls = (LUT - 1) / e2;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) & NM;
    const x0 = px[i], y0 = py[i], x1 = px[j], y1 = py[j], dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    const il = L2 > 1e-9 ? 1 / L2 : 0, b0 = bb[i], db = bb[j] - b0, g = gs ? gs[i] : 1;
    const xa = max(0, floor(min(x0, x1) - ext)), xb = min(W - 1, floor(max(x0, x1) + ext));
    const ya = max(0, floor(min(y0, y1) - ext)), yb = min(H - 1, floor(max(y0, y1) + ext));
    for (let y = ya; y <= yb; y++) {
      const Y = y + 0.5;
      for (let x = xa; x <= xb; x++) {
        const X = x + 0.5;
        let t = ((X - x0) * dx + (Y - y0) * dy) * il;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = X - x0 - t * dx, ey = Y - y0 - t * dy, d2 = ex * ex + ey * ey;
        if (d2 >= e2) continue;
        const v = lut[(d2 * ls) | 0] * g, p = y * W + x;
        if (v > cov[p]) {
          cov[p] = v;
          bv[p] = b0 + t * db;
        }
      }
    }
  }
}

function compose(st, tab, al, x0, y0, x1, y1) {
  const { cov, bv, fb } = st;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * W + x, v = cov[p];
      if (v === 0) continue;
      cov[p] = 0;
      const q = cl((bv[p] * 10 + 120.5) | 0, 0, 240) * 3, a = v * al, o = p * 3;
      fb[o] += tab[q] * a;
      fb[o + 1] += tab[q + 1] * a;
      fb[o + 2] += tab[q + 2] * a;
    }
  }
}

function blob(fb, bx, by, s, amp, r, g, b, ext) {
  const i2 = 1 / (2 * s * s), y0 = max(0, floor(by - ext)), y1 = min(H - 1, floor(by + ext));
  const x0 = max(0, floor(bx - ext)), x1 = min(W - 1, floor(bx + ext));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - bx, dy = y + 0.5 - by, a = amp * exp(-(dx * dx + dy * dy) * i2);
      if (a < 0.006) continue;
      const p = (y * W + x) * 3;
      fb[p] += r * a;
      fb[p + 1] += g * a;
      fb[p + 2] += b * a;
    }
  }
}

function drawCircle(st, ci) {
  const c = st.c[ci], t = st.t, ph = st.ph, o = ci * 6, k0 = st.k[0];
  const cx = 32 + 2.2 * sin((TP * t) / (ci ? 59 : 47) + ph[o]) + 0.6 * sin((TP * t) / (ci ? 97 : 83) + ph[o + 4]);
  const cy = (ci ? 95.5 : 32.5) + 2.8 * sin((TP * t) / (ci ? 71 : 67) + ph[o + 1]) + 0.7 * sin((TP * t) / (ci ? 103 : 89) + ph[o + 5]);
  const sc = 0.97 + 0.1 * sin((TP * t) / (ci ? 79 : 73) + ph[o + 2]) - 0.02;
  const rot = ci ? -(TP * t) / 241 + ph[o + 2] : (TP * t) / 173 + ph[o + 2];
  const hp = k0 + 0.105 + 0.027 * sin((TP * t) / (ci ? 97 : 89) + ph[o + 3]) + 0.013 * sin((TP * t) / (ci ? 151 : 131) + ph[o + 4]);
  const hn = k0 + 0.5 + 0.05 * sin((TP * t) / (ci ? 113 : 107) + ph[o + 5]) + 0.03 * sin((TP * t) / (ci ? 173 : 157) + ph[o + 3]);
  const { tab, rad, bb, px, py, fb, gs } = st;
  buildTab(tab, hp, hn);
  const cr = cos(rot), sr = sin(rot);
  // a light that circles the ring on its own two slow periods: some arcs of the ring burn brighter than others
  const ga = (TP * t) / (ci ? 41 : 37) + ph[o + 4], gb = -(TP * t) / (ci ? 61 : 53) + ph[o + 1];
  for (let i = 0; i < N; i++) gs[i] = 0.9 + 0.14 * sin((TP * i) / N + ga) + 0.07 * sin((2 * TP * i) / N + gb);
  for (let i = 0; i < N; i++) {
    const b = c.a[i] * SQN;
    bb[i] = b;
    rad[i] = min(RMAX, rmap(b) * sc);
  }
  const ex = RMAX + EXT + 1;
  const bx0 = max(0, floor(cx - ex)), bx1 = min(W - 1, floor(cx + ex)), by0 = max(0, floor(cy - ex)), by1 = min(H - 1, floor(cy + ex));
  // a deep teal glow behind each circle, in the negative colour, so the ring and its needles stand on a lit ground
  const ac = [0, 0, 0];
  hsv(hn, 0.7, 1, ac, 0);
  {
    const AR = 36, ar2 = AR * AR;
    for (let y = max(0, floor(cy - AR)); y <= min(H - 1, floor(cy + AR)); y++) {
      const dy = y + 0.5 - cy;
      for (let x = max(0, floor(cx - AR)); x <= min(W - 1, floor(cx + AR)); x++) {
        const dx = x + 0.5 - cx, u = 1 - (dx * dx + dy * dy) / ar2;
        if (u <= 0) continue;
        const a = 0.13 * u * u, p = (y * W + x) * 3;
        fb[p] += ac[0] * a;
        fb[p + 1] += ac[1] * a;
        fb[p + 2] += ac[2] * a;
      }
    }
  }
  // the faint fill under the curve and the reference ring of the uniform superposition
  const fe = RMAX + 1, fe2 = fe * fe, kn = N / TP;
  const fx0 = max(0, floor(cx - fe)), fx1 = min(W - 1, floor(cx + fe)), fy0 = max(0, floor(cy - fe)), fy1 = min(H - 1, floor(cy + fe));
  const rc = [0, 0, 0];
  hsv(hn, 0.55, 1, rc, 0);
  for (let y = fy0; y <= fy1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = fx0; x <= fx1; x++) {
      const dx = x + 0.5 - cx, r2 = dx * dx + dy * dy;
      if (r2 > fe2) continue;
      const rho = sqrt(r2), p = (y * W + x) * 3, dr = rho - RU * sc;
      if (dr * dr < 6) {
        const a = 0.17 * exp(-(dr * dr) / 0.9);
        fb[p] += rc[0] * a;
        fb[p + 1] += rc[1] * a;
        fb[p + 2] += rc[2] * a;
      }
      let s = (atan2(dy, dx) - rot) * kn;
      s -= floor(s / N) * N;
      const i0 = floor(s), f = s - i0, i1 = (i0 + 1) & NM;
      const R = rad[i0] + f * (rad[i1] - rad[i0]);
      if (rho >= R) continue;
      const q = cl(((bb[i0] + f * (bb[i1] - bb[i0])) * 10 + 120.5) | 0, 0, 240) * 3, u = rho / R, a = (0.02 + 0.26 * u * u * u) * gs[i0];
      fb[p] += tab[q] * a;
      fb[p + 1] += tab[q + 1] * a;
      fb[p + 2] += tab[q + 2] * a;
    }
  }
  // afterimages of the last iterations, then the ring itself
  for (let s = 0; s < 4; s++) {
    const age = c.sage[s], al = 0.34 * sstep(age / 0.25) * exp(-age / 0.9);
    if (al < 0.015) continue;
    const sb = c.sn[s];
    for (let i = 0; i < N; i++) {
      const r = min(RMAX, rmap(sb[i]) * sc), cc = cr * CS[i] - sr * SN[i], ss = sr * CS[i] + cr * SN[i];
      px[i] = cx + r * cc;
      py[i] = cy + r * ss;
    }
    stroke(st, px, py, sb, LUTG, EXTG);
    compose(st, tab, al, bx0, by0, bx1, by1);
  }
  for (let i = 0; i < N; i++) {
    const r = rad[i], cc = cr * CS[i] - sr * SN[i], ss = sr * CS[i] + cr * SN[i];
    px[i] = cx + r * cc;
    py[i] = cy + r * ss;
  }
  stroke(st, px, py, bb, LUTM, EXT, gs);
  compose(st, tab, 1, bx0, by0, bx1, by1);
  // beads on the marked spokes, and the flash on the measured one
  for (let i = 0; i < N; i++) {
    const a = c.bd[i];
    if (a < 0.03) continue;
    const q = cl((bb[i] * 10 + 120.5) | 0, 0, 240) * 3;
    const wr = 0.45 + 0.55 * tab[q], wg = 0.45 + 0.55 * tab[q + 1], wb = 0.45 + 0.55 * tab[q + 2];
    blob(fb, px[i], py[i], 1.25, 1.3 * a, wr, wg, wb, 4);
    blob(fb, px[i], py[i], 3, 0.22 * a, tab[q], tab[q + 1], tab[q + 2], 8);
  }
  if (c.fl > 0.02) {
    const j = c.ej, q = cl((bb[j] * 10 + 120.5) | 0, 0, 240) * 3;
    blob(fb, px[j], py[j], 3.2, 1.5 * c.fl, 0.6 + 0.4 * tab[q], 0.6 + 0.4 * tab[q + 1], 0.6 + 0.4 * tab[q + 2], 12);
  }
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const fb = st.fb;
  fb.fill(0);
  drawCircle(st, 0);
  drawCircle(st, 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, d = BAYER[((y & 3) << 2) | (x & 3)];
      display.setPixel(
        x, y,
        cl(floor(255 * (1 - exp(-1.5 * fb[p])) + d), 0, 255),
        cl(floor(255 * (1 - exp(-1.5 * fb[p + 1])) + d), 0, 255),
        cl(floor(255 * (1 - exp(-1.5 * fb[p + 2])) + d), 0, 255),
      );
    }
  }
}
