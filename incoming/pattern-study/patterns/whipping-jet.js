// ===== Patternflow pattern =====
// Title:   Whipping Jet
// Family:  electrospinning
// Idea:    Four charged polymer jets leave needles at the top of the panel and fall straight toward a collector plate until their own charge makes them bend, and then each one whips in loops that widen into a cone of bright fibre, the neighbouring cones overlap, and the fibre lands on a mat of aqua loops that builds along the bottom and slowly fades.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: electrospinning, the bending instability of a charged jet in an electric field as Reneker, Yarin, Fong and Koombhongse modelled it with beads, springs and dashpots (2000, from memory), the cone that feeds the jet after G. I. Taylor (1964), pattern round 238
// Round:   238
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Field=0.6..3.6, Charge=-1..1, Feed=-1..1
//
// Knob 1: Hue.
// Knob 2: Field.
// Knob 3: Charge.
// Knob 4: Feed.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, exp, pow, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rr = (a, b) => a + (b - a) * Math.random();

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour on the red-orange-yellow stretch of the wheel reads brown when it is not bright, so it is paled there.
function warm(h, s, v, out, o) {
  const c = h - floor(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.3 * b), min(1, v * (1 + 0.9 * b * (1 - v))), out, o);
}
// Along the fibre by age: hue and saturation. Pale lavender at the needle, cyan, then magenta at the plate.
const KA = [0, 0.15, 0.38, 0.6, 0.8, 1];
const KH = [0.73, 0.71, 0.52, 0.62, 0.8, 0.88];
const KS = [0.12, 0.38, 0.7, 0.5, 0.62, 0.72];

// ---- the model ------------------------------------------------------------
const NJ = 4;
const CAPB = 190;
const Z0 = 3.5, ZC = 115;
const SUB = 1 / 120;
const P = { EXF: 1.2, EXE: 0.6, TILT: 0.4, QLO: 0.05, TQ: 1.0, KW: 20, KWZ: 0.4, sg0: 1, E: 40, c: 1.0, Q: 4000, EPS2: 36, Kt: 100, lam: 0.6, v0: 15, rate: 32, XQ: 0.35, EPSX2: 64, vmax: 220 , GUST: 15, R0: 900};

const f64 = () => new Float64Array(CAPB);
function newJet(i) {
  const wob = [];
  for (let k = 0; k < 6; k++) wob.push({ a: rr(0.12, 0.32), w: 2 + 3 * k + rr(0, 2), p: rr(0, TAU), q: rr(0, TAU) });
  const sw = (a, lo, hi) => ({ a, T: rr(lo, hi), p: rr(0, TAU) });
  return {
    i, base: 9 + (46 * i) / (NJ - 1), x0: 9 + (46 * i) / (NJ - 1), n: 0, acc: 0, wob,
    x: f64(), y: f64(), z: f64(), vx: f64(), vy: f64(), vz: f64(), fx: f64(), fy: f64(), fz: f64(),
    sg: f64(), l0: f64(), age: f64(), qq: f64(),
    fm: 1, qm: 1, ho: 0, gain: 1, rel: 1, kwm: 1,
    gw: [rr(1.5, 3.5), rr(0, TAU), rr(1.5, 3.5), rr(0, TAU)],
    sk: [sw(0.14, 27, 67), sw(0.06, 11, 17)],
    sx: [sw(2.4, 37, 71), sw(1.4, 17, 29)],
    sf: [sw(0.26, 29, 61), sw(0.13, 11, 19)],
    sq: [sw(0.16, 23, 47), sw(0.06, 9, 15)],
    sh: [sw(0.07, 41, 91), sw(0.04, 19, 33)],
    lx: 0, ly: 0, lok: false,
  };
}

function inject(J, t) {
  const n = J.n;
  if (n >= CAPB) return;
  let ox = 0, oy = 0, ovx = 0, ovy = 0;
  for (const w of J.wob) {
    ox += w.a * sin(w.w * t + w.p);
    ovx += w.a * w.w * cos(w.w * t + w.p);
    oy += w.a * sin(w.w * t * 1.13 + w.q);
    ovy += w.a * w.w * 1.13 * cos(w.w * t * 1.13 + w.q);
  }
  const sd = 0.3, gj = () => (Math.random() - 0.5) * 0.1;
  J.x[n] = J.x0 + (ox + gj()) * sd;
  J.y[n] = (oy + gj()) * sd;
  J.z[n] = Z0;
  J.vx[n] = ovx * 0.5 * sd;
  J.vy[n] = ovy * 0.5 * sd;
  J.vz[n] = P.v0;
  J.age[n] = 0;
  if (n > 0) {
    const dx = J.x[n] - J.x[n - 1], dy = J.y[n] - J.y[n - 1], dz = J.z[n] - J.z[n - 1];
    J.l0[n - 1] = max(0.05, sqrt(dx * dx + dy * dy + dz * dz));
    J.sg[n - 1] = P.sg0;
  }
  J.n = n + 1;
}

function stepJets(st, dt, t) {
  const jets = st.jets, E = P.E * st.kE, Q0 = P.Q * st.kQ;
  for (const J of jets) {
    const n = J.n, { x, y, z, fx, fy, fz, qq, age } = J, Q = Q0 * J.qm * pow((st.kF * J.fm) / 0.85, -P.EXF);
    for (let i = 0; i < n; i++) {
      fx[i] = 0;
      fy[i] = 0;
      fz[i] = E;
      qq[i] = P.QLO + (1 - P.QLO) * (1 - exp(-age[i] / P.TQ));
    }
    for (let a = 0; a < n - 1; a++) {
      const xa = x[a], ya = y[a], za = z[a], qa = Q * qq[a];
      let ax = 0, ay = 0;
      for (let b = a + 1; b < n; b++) {
        const dx = xa - x[b], dy = ya - y[b], dz = za - z[b];
        const r2 = dx * dx + dy * dy + dz * dz + P.EPS2, inv = (qa * qq[b]) / (r2 * sqrt(r2));
        const gx = dx * inv, gy = dy * inv;
        ax += gx;
        ay += gy;
        fx[b] -= gx;
        fy[b] -= gy;
      }
      fx[a] += ax;
      fy[a] += ay;
    }
  }
  // Neighbouring jets push on each other through every third bead.
  for (let j = 0; j < NJ - 1; j++) {
    const A = jets[j], B = jets[j + 1], q = Q0 * P.XQ * 3 * sqrt(A.qm * B.qm) * pow(st.kF, -P.EXF) * pow((A.fm * B.fm) / 0.7225, -0.5 * P.EXF);
    for (let s = 0; s < 2; s++) {
      const U = s ? B : A, V = s ? A : B;
      for (let a = 0; a < U.n; a++) {
        let ax = 0, ay = 0;
        const xa = U.x[a], ya = U.y[a], za = U.z[a], qa = q * U.qq[a];
        for (let b = a % 3; b < V.n; b += 3) {
          const dx = xa - V.x[b], dy = ya - V.y[b], dz = za - V.z[b];
          const r2 = dx * dx + dy * dy + dz * dz + P.EPSX2, inv = (qa * V.qq[b]) / (r2 * sqrt(r2));
          ax += dx * inv;
          ay += dy * inv;
        }
        U.fx[a] += ax;
        U.fy[a] += ay;
      }
    }
  }
  const decay = 1 / (1 + dt / P.lam), dm = 1 / (1 + P.c * dt);
  for (const J of jets) {
    const n = J.n, { x, y, z, vx, vy, vz, fx, fy, fz, sg, l0, age } = J;
    for (let i = 0; i < n - 1; i++) {
      const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], dz = z[i + 1] - z[i];
      const l = sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, ux = dx / l, uy = dy / l, uz = dz / l;
      const ld = (vx[i + 1] - vx[i]) * ux + (vy[i + 1] - vy[i]) * uy + (vz[i + 1] - vz[i]) * uz;
      const s = (sg[i] + (dt * ld) / l) * decay;
      sg[i] = s;
      const T = (P.Kt * s * l0[i]) / l;
      fx[i] += T * ux;
      fy[i] += T * uy;
      fz[i] += T * uz;
      fx[i + 1] -= T * ux;
      fy[i + 1] -= T * uy;
      fz[i + 1] -= T * uz;
    }
    for (let i = 0; i < n; i++) {
      const ex = x[i] - J.x0, ey = y[i];
      const kw = P.KW * J.kwm * (1 + (P.KWZ - 1) * cl(z[i] / ZC, 0, 1)) * (1 + (ex * ex + ey * ey) / P.R0);
      const gs = P.GUST * sstep(5, 45, z[i]);
      fx[i] -= kw * ex - gs * sin(0.11 * z[i] + J.gw[0] * t + J.gw[1]);
      fy[i] -= kw * ey - gs * cos(0.09 * z[i] - J.gw[2] * t + J.gw[3]);
      let a = (vx[i] + fx[i] * dt) * dm, b = (vy[i] + fy[i] * dt) * dm, c = (vz[i] + fz[i] * dt) * dm;
      const sp = sqrt(a * a + b * b + c * c);
      if (sp > P.vmax) {
        const s = P.vmax / sp;
        a *= s;
        b *= s;
        c *= s;
      }
      vx[i] = a;
      vy[i] = b;
      vz[i] = c;
      x[i] += a * dt;
      y[i] += b * dt;
      z[i] += c * dt;
      age[i] += dt;
    }
    // Any bead that has reached the collector lands, wherever it sits in the chain.
    let m = 0;
    for (let i = 0; i < n; i++) {
      // a bead that lands, or that has somehow left the working volume, comes out of the chain
      const ok = abs(x[i] - J.x0) < 90 && abs(y[i]) < 90;
      if (!(z[i] < ZC) || !ok) {
        if (ok && z[i] >= ZC) land(st, J, x[i], y[i], age[i]);
        continue;
      }
      if (m !== i) {
        x[m] = x[i]; y[m] = y[i]; z[m] = z[i]; vx[m] = vx[i]; vy[m] = vy[i]; vz[m] = vz[i]; age[m] = age[i];
        sg[m] = sg[i]; l0[m] = l0[i];
      }
      m++;
    }
    J.n = m;
    J.acc += P.rate * st.kF * J.fm * dt;
    while (J.acc >= 1) {
      J.acc -= 1;
      inject(J, t);
    }
  }
}

// ---- the mat --------------------------------------------------------------
const MAT0 = 100, MATN = 24;
function splat(mat, x, r, w) {
  const fr = mat.fresh;
  const xi = floor(x - 0.5), xf = x - 0.5 - xi, ri = floor(r - 0.5), rf = r - 0.5 - ri;
  for (let j = 0; j < 2; j++) {
    const rj = ri + j;
    if (rj < 0 || rj >= MATN) continue;
    const wr = j ? rf : 1 - rf;
    for (let i = 0; i < 2; i++) {
      const xj = xi + i;
      if (xj < 0 || xj >= W) continue;
      const a = w * wr * (i ? xf : 1 - xf);
      mat[rj * W + xj] += a;
      fr[rj * W + xj] += a;
    }
  }
}
// A bead reaches the plate: the fibre between its landing point and the last one lies on the mat.
function land(st, J, x, y, age) {
  st.ageEma += (age - st.ageEma) * 0.01;
  const r = ZC + P.TILT * y - MAT0;
  if (J.lok) {
    const dx = x - J.lx, dr = r - J.ly, len = sqrt(dx * dx + dr * dr);
    if (len < 22) {
      const k = max(1, ceil(len / 0.7));
      for (let s = 1; s <= k; s++) splat(st.mat, J.lx + (dx * s) / k, J.ly + (dr * s) / k, 0.007 * (len / k + 0.3) * J.gain);
    }
  }
  J.lx = x;
  J.ly = r;
  J.lok = true;
}

const mkMat = () => {
  const m = new Float32Array(MATN * W);
  m.fresh = new Float32Array(MATN * W);
  return m;
};

// ---- state ----------------------------------------------------------------
export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], t: 0, init: false, acc: 0,
    kE: 1, kQ: 1, kF: 1, ageEma: 3.8,
    jets: Array.from({ length: NJ }, (_, i) => newJet(i)),
    R: new Float32Array(NPX), G: new Float32Array(NPX), B: new Float32Array(NPX),
    JI: new Float32Array(NPX), FR: new Float32Array(NPX), FG: new Float32Array(NPX), FB: new Float32Array(NPX), TM: new Float32Array(NPX), mat: mkMat(),
    fl: Array.from({ length: 8 }, (_, i) => ({ x: 4 + i * 8, a: rr(0.5, 1), T: rr(31, 83), p: rr(0, TAU), T2: rr(13, 29), q: rr(0, TAU) })),
    sx1: new Float32Array(W), sx2: new Float32Array(W), sy1: new Float32Array(H), sy2: new Float32Array(H),
    hz: [rr(0, TAU), rr(0, TAU), rr(0, TAU), rr(0, TAU)],
  };
}

function knobs(st, kv) {
  st.k = [kv[0], cl(kv[1], 0.6, 3.6), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  st.kE = pow(st.k[1] / 2, 1.0);
  st.kQ = exp(0.7 * st.k[2]) * pow(st.kE, P.EXE);
  st.kF = exp(0.5 * st.k[3]);
}

const wave = (arr, t) => {
  let v = 0;
  for (const w of arr) v += w.a * sin((TAU * t) / w.T + w.p);
  return v;
};

function modulate(st, t) {
  for (const J of st.jets) {
    J.x0 = J.base + wave(J.sx, t);
    J.fm = 0.85 + wave(J.sf, t);
    J.qm = 1 + wave(J.sq, t);
    J.kwm = 1 + wave(J.sk, t);
    J.ho = wave(J.sh, t);
    J.rel = (st.kF * J.fm) / 0.85;
    J.gain = cl(0.45 + 0.55 * J.rel, 0.5, 1.1);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  knobs(st, kv);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 480; i++) advance(st, 1 / 60);
    // the mat has not had time to build: it fades over 25 s and the run above was 8, so it is brought to what it would hold by now
    for (let i = 0; i < st.mat.length; i++) st.mat[i] *= 5;
  }
  st.acc += cl(dt || 0, 0, 0.1);
  while (st.acc >= SUB) {
    st.acc -= SUB;
    advance(st, SUB);
  }
}

function advance(st, d) {
  st.t += d;
  modulate(st, st.t);
  stepJets(st, d, st.t);
  const f = exp((-d * 0.6931) / 25), g = exp(-d / 1.2), mat = st.mat, fr = mat.fresh;
  for (let i = 0; i < mat.length; i++) {
    mat[i] *= f;
    fr[i] *= g;
  }
}

// ---- drawing --------------------------------------------------------------
function seg(st, ax, ay, bx, by, hw, r, g, b) {
  const { FR: R, FG: G, FB: B, JI } = st;
  const lo = hw + 1.2;
  const px0 = max(0, floor(min(ax, bx) - lo)), px1 = min(W - 1, floor(max(ax, bx) + lo));
  const py0 = max(0, floor(min(ay, by) - lo)), py1 = min(H - 1, floor(max(ay, by) + lo));
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy + 1e-9;
  for (let py = py0; py <= py1; py++) {
    const cy = py + 0.5 - ay;
    for (let px = px0; px <= px1; px++) {
      const cx = px + 0.5 - ax;
      const q = cl((cx * dx + cy * dy) / l2, 0, 1);
      const ex = cx - q * dx, ey = cy - q * dy;
      const c = cl(hw + 0.75 - sqrt(ex * ex + ey * ey), 0, 1);
      const o = py * W + px;
      if (c > JI[o]) {
        const d = c - JI[o];
        JI[o] = c;
        R[o] += r * d;
        G[o] += g * d;
        B[o] += b * d;
      }
    }
  }
}

const colv = [0, 0, 0];
const NS = CAPB + 8;
const SX = new Float32Array(NS), SY = new Float32Array(NS), SD = new Float32Array(NS), SA = new Float32Array(NS);
const TX = new Float32Array(NS), TY = new Float32Array(NS), TD = new Float32Array(NS);

function drawJet(st, J, hueK) {
  const n = J.n;
  if (n < 2) return;
  st.JI.fill(0);
  const { x, y, z, age } = J, ar = max(0.5, st.ageEma);
  for (let i = 0; i < n; i++) {
    TX[i] = x[i];
    TY[i] = z[i] + P.TILT * y[i];
    TD[i] = y[i];
    SA[i] = age[i] / ar;
  }
  // two passes of smoothing round off the corners of the chain
  for (let p = 0; p < 2; p++) {
    for (let i = 1; i < n - 1; i++) {
      SX[i] = 0.25 * TX[i - 1] + 0.5 * TX[i] + 0.25 * TX[i + 1];
      SY[i] = 0.25 * TY[i - 1] + 0.5 * TY[i] + 0.25 * TY[i + 1];
      SD[i] = 0.25 * TD[i - 1] + 0.5 * TD[i] + 0.25 * TD[i + 1];
    }
    for (let i = 1; i < n - 1; i++) {
      TX[i] = SX[i];
      TY[i] = SY[i];
      TD[i] = SD[i];
    }
  }
  let px = TX[0], py = TY[0];
  const hue0 = hueK + J.ho;
  for (let i = 0; i < n - 1; i++) {
    const i0 = max(0, i - 1), i1 = i, i2 = i + 1, i3 = min(n - 1, i + 2);
    const dx = TX[i2] - TX[i1], dy = TY[i2] - TY[i1];
    const len = sqrt(dx * dx + dy * dy);
    const S = cl(ceil(len / 1.5), 1, 5);
    for (let s = 1; s <= S; s++) {
      const u = s / S, u2 = u * u, u3 = u2 * u;
      const qx = 0.5 * (2 * TX[i1] + (-TX[i0] + TX[i2]) * u + (2 * TX[i0] - 5 * TX[i1] + 4 * TX[i2] - TX[i3]) * u2 + (-TX[i0] + 3 * TX[i1] - 3 * TX[i2] + TX[i3]) * u3);
      const qy = 0.5 * (2 * TY[i1] + (-TY[i0] + TY[i2]) * u + (2 * TY[i0] - 5 * TY[i1] + 4 * TY[i2] - TY[i3]) * u2 + (-TY[i0] + 3 * TY[i1] - 3 * TY[i2] + TY[i3]) * u3);
      const dep = TD[i1] + (TD[i2] - TD[i1]) * u;
      const dc = cl(0.5 + dep / 26, 0, 1);
      const a = cl(SA[i1] + (SA[i2] - SA[i1]) * u, 0, 1);
      let k = 0;
      while (k < KA.length - 2 && a > KA[k + 1]) k++;
      const f = cl((a - KA[k]) / (KA[k + 1] - KA[k]), 0, 1);
      const sat = KS[k] + (KS[k + 1] - KS[k]) * f, hue = KH[k] + (KH[k + 1] - KH[k]) * f + hue0;
      warm(hue, sat, (0.4 + 0.6 * dc) * J.gain, colv, 0);
      seg(st, px, py, qx, qy, (0.68 + 0.37 * dc) * cl(0.85 + 0.3 * (J.rel - 1), 0.7, 1.15), colv[0], colv[1], colv[2]);
      px = qx;
      py = qy;
    }
  }
}

function drawBackground(st, t, hueK) {
  const { R, G, B, sx1, sx2, sy1, sy2, hz } = st;
  for (let x = 0; x < W; x++) {
    sx1[x] = sin(x * 0.11 + hz[0] + t * 0.07);
    sx2[x] = sin(x * 0.23 + hz[1] - t * 0.11);
  }
  for (let y = 0; y < H; y++) {
    sy1[y] = sin(y * 0.071 + hz[2] - t * 0.05);
    sy2[y] = sin(y * 0.15 + hz[3] + t * 0.09);
  }
  const tb = [0, 0, 0];
  hsv(0.58 + 0.1 * sin(TAU * hueK), 0.85, 0.5, tb, 0);
  const cr = tb[0], cg = tb[1], cb = tb[2];
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const gr = 0.8 + 0.4 * v;
    for (let x = 0, o = y * W; x < W; x++, o++) {
      const h = gr * (1 + 0.16 * sx1[x] * sy1[y] + 0.1 * sx2[x] * sy2[y]);
      R[o] = (0.015 + 0.04 * cr) * h;
      G[o] = (0.07 + 0.1 * cg) * h;
      B[o] = (0.12 + 0.12 * cb) * h;
    }
  }
  // a few faint field lines from the needles to the plate
  for (const f of st.fl) {
    const fx = f.x + 3.5 * sin((TAU * t) / f.T + f.p) + 1.8 * sin((TAU * t) / f.T2 + f.q);
    const x0 = max(0, floor(fx - 2.5)), x1 = min(W - 1, floor(fx + 2.5));
    for (let x = x0; x <= x1; x++) {
      const c = 0.07 * f.a * exp(-0.5 * ((x + 0.5 - fx) / 0.9) ** 2);
      for (let y = 0; y < H - 5; y++) {
        const o = y * W + x, sh = 0.75 + 0.25 * sin(y * 0.09 - t * 0.8 + f.p);
        R[o] += c * 0.25 * sh;
        G[o] += c * 0.95 * sh;
        B[o] += c * 1.0 * sh;
      }
    }
  }
}

function drawMat(st, hueK) {
  const { R, G, B, mat } = st, fr = mat.fresh;
  const col = [0, 0, 0];
  warm(0.5 + 0.18 * sin(TAU * hueK), 0.6, 1, col, 0);
  for (let r = 0; r < MATN; r++) {
    const y = MAT0 + r;
    for (let x = 0; x < W; x++) {
      const m = mat[r * W + x], fv = fr[r * W + x];
      if (m < 0.003) continue;
      const e = cl((m - 0.07) / 0.4, 0, 1), b = 0.8 * pow(e, 1.5) + 0.55 * (1 - exp(-2.5 * fv));
      const o = y * W + x;
      R[o] += col[0] * b;
      G[o] += col[1] * b;
      B[o] += col[2] * b;
    }
  }
  // the collector, a long bar with a bright upper edge
  for (let y = H - 5; y < H; y++) {
    const e = y === H - 5 ? 1 : 0.4 - 0.07 * (y - H + 5);
    for (let x = 0, o = y * W; x < W; x++, o++) {
      R[o] = 0.03 + 0.1 * col[0] * e;
      G[o] = 0.16 + 0.55 * col[1] * e;
      B[o] = 0.22 + 0.55 * col[2] * e;
    }
  }
}

function drawNeedles(st) {
  const { R, G, B } = st;
  for (const J of st.jets) {
    const cx = J.x0;
    // the glow round the tip
    for (let y = 0; y < 14; y++)
      for (let x = max(0, floor(cx - 9)); x <= min(W - 1, floor(cx + 9)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - 3.5, g = 0.5 * exp(-(dx * dx + dy * dy) / 14) * J.gain;
        const o = y * W + x;
        R[o] += 0.3 * g;
        G[o] += 0.3 * g;
        B[o] += 0.42 * g;
      }
    // a short bright stub
    for (let y = 0; y < 4; y++) {
      const w = y < 3 ? 1.25 : 0.9;
      for (let x = max(0, floor(cx - 2)); x <= min(W - 1, floor(cx + 2)); x++) {
        const c = cl(w + 0.5 - abs(x + 0.5 - cx), 0, 1), o = y * W + x;
        R[o] += 0.8 * c;
        G[o] += 0.78 * c;
        B[o] += 1.0 * c;
      }
    }
  }
}

// A soft halo: the layer plus half of itself blurred by a 1-2-1 pass across and one down.
function glow(F, T) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) T[o + x] = 0.25 * F[o + (x > 0 ? x - 1 : 0)] + 0.5 * F[o + x] + 0.25 * F[o + (x < W - 1 ? x + 1 : x)];
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, u = (y > 0 ? y - 1 : 0) * W, d = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) F[o + x] += 0.5 * (0.25 * T[u + x] + 0.5 * T[o + x] + 0.25 * T[d + x]);
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { R, G, B } = st, hueK = st.k[0];
  drawBackground(st, st.t, hueK);
  drawMat(st, hueK);
  drawNeedles(st);
  // fibre is drawn into the same buffers; jets add to each other, a jet's own loops take the brighter
  st.FR.fill(0);
  st.FG.fill(0);
  st.FB.fill(0);
  for (const J of st.jets) drawJet(st, J, hueK);
  glow(st.FR, st.TM);
  glow(st.FG, st.TM);
  glow(st.FB, st.TM);
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const r = R[o] + st.FR[o], g = G[o] + st.FG[o], b = B[o] + st.FB[o];
      display.setPixel(x, y, floor(255 * (1 - exp(-1.6 * r))), floor(255 * (1 - exp(-1.6 * g))), floor(255 * (1 - exp(-1.6 * b))));
    }
}
