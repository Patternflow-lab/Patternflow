// ===== Patternflow pattern =====
// Title:   Force Chains
// Family:  particle
// Idea:    About 175 soft discs fill a tall box seen in white light between crossed circular polarisers and are squeezed in turn by a piston on top and by the side walls, and only the discs that carry the load light up in isochromatic fringes, grey, white, yellow, orange, red, violet and blue, along branching chains that swing from upright to sideways and find new paths as the push moves, while the discs between them stay dark.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: photoelastic force chains (Pierre Dantu, 1957; Trushant Majmudar and Robert Behringer, 2005), pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Analyser=0..1, Speed=0.2..3, Load=-1..1, Grain=0..1
//
// Knob 1: Analyser. Turns the analyser away from crossed, a quarter turn over the range. At 0 the field is dark: an unloaded disc is black and only the loaded ones light up; turning it shifts every fringe along the colour sequence, and at 1 the field is light: unloaded discs shine white and the chains show as dark and coloured bands.
// Knob 2: Speed. At 2 a round takes 6 s: the piston presses hardest at 0 s while the walls ease off, and at 3 s the walls squeeze hardest while the piston eases to a fifth. In each squeeze one wall pushes three times as hard as the other, the left in one round and the right in the next, so the pile leans one way and then the other and the whole sequence takes 12 s. At 0.2 it is ten times slower, at 3 half as fast again; the discs always move at their own pace.
// Knob 3: Load. The hardest push of the piston and of the walls, as a multiple of the weight of the pile spread over the floor: 1.5 at -1, 3 at 0 and 6 at 1. At -1 the chains are thin and grey-white with a little yellow; at 1 they thicken and the strongest discs low in the pile run through red and blue into the pale pinks and greens of high orders.
// Knob 4: Grain. The size of the discs: at 0.06 they are 6.3 and 8.1 LEDs across, 175 of them; at 0.5 8.5 and 11, 95 of them; at 1 12 and 15.6, 48 discs whose fringes show the whole pattern of a disc squeezed at its contacts. A new size pours a new pile.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, sin, cos, PI, pow, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Gravity in LEDs a second squared, physics steps a frame, and the most
// contacts one disc keeps.
const G = 50, SUB = 16, MC = 8;
// Normal stiffness per unit of the weight pressure on the floor, tangential
// stiffness as a share of it, the friction coefficient, the share of critical
// damping a contact gets along its normal and the share of that along its
// tangent, and the drag every disc feels, per second.
const KS = 150, KT = 0.4, MU = 0.5, ZETA = 0.35, TD = 0.2, DRAG = 2.5;
// One round at Speed 2 in seconds. The piston and the two side walls are
// heavy plates pushed with set pressures, as shares of the Load: the piston
// from SY0 to SY1 and the walls from SX0 to SX1 and back. Each wall is NS
// plates stacked up its height, like a membrane, so the squeeze does not all
// land on the stiff bottom of the pile. A wall plate stops at WOUT LEDs
// outside the panel's edge and WIN inside it. One wall pushes 1 + LEAN of
// the set pressure and the other 1 - LEAN, the left in one round and the
// right in the next, and the pile leans.
const T_R = 6, SY0 = 1, SY1 = 0.2, SX0 = 0.2, SX1 = 1, NS = 8, WOUT = 2, WIN = 3, PD = 30, LEAN = 0.5;
// White-light fringe colours: retardation in nanometres per LUT step, the
// steps, and the wavelength the fringe order is counted at.
const LS = 3, LN = 1024, L0 = 560;
// Contact softening: the squared radius in LEDs over which a point load spreads.
const A2 = 0.25;
// Fringes made by the weight pressure on the floor, and the LUT's gamma.
const FR = 0.09, GAM = 1.0;

// CIE 1931 colour matching, as the piecewise Gaussian fit of Wyman, Sloan
// and Shirley (2013).
const gp = (l, m, s1, s2) => {
  const t = (l - m) / (l < m ? s1 : s2);
  return exp(-0.5 * t * t);
};
const XB = (l) => 1.056 * gp(l, 599.8, 37.9, 31) + 0.362 * gp(l, 442, 16, 26.7) - 0.065 * gp(l, 501.1, 20.4, 26.2);
const YB = (l) => 0.821 * gp(l, 568.8, 46.9, 40.5) + 0.286 * gp(l, 530.9, 16.3, 31.1);
const ZB = (l) => 1.217 * gp(l, 437, 11.8, 36) + 0.681 * gp(l, 459, 26, 13.8);

// The colour seen through a circular polariscope at each retardation, for an
// analyser turned beta from crossed: each wavelength passes sin^2(pi R/l + beta).
function buildLut(S, beta) {
  const lut = S.lut, ws = [];
  for (let l = 400; l <= 700; l += 10) ws.push(l);
  let wr = 0, wg = 0, wb = 0;
  const rgb = (X, Y, Z) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  {
    let X = 0, Y = 0, Z = 0;
    for (const l of ws) (X += XB(l)), (Y += YB(l)), (Z += ZB(l));
    [wr, wg, wb] = rgb(X, Y, Z);
  }
  for (let i = 0; i < LN; i++) {
    const R = i * LS;
    let X = 0, Y = 0, Z = 0;
    for (const l of ws) {
      const s = sin((PI * R) / l + beta), I = s * s;
      X += I * XB(l);
      Y += I * YB(l);
      Z += I * ZB(l);
    }
    const c = rgb(X, Y, Z);
    lut[i * 3] = pow(cl(c[0] / wr, 0, 1), GAM) * 255;
    lut[i * 3 + 1] = pow(cl(c[1] / wg, 0, 1), GAM) * 255;
    lut[i * 3 + 2] = pow(cl(c[2] / wb, 0, 1), GAM) * 255;
  }
  S.beta = beta;
}

const NMAX = 400, WALL = 1000;
export function setup(params) {
  const F = (k) => new Float64Array(NMAX * k);
  params.s = {
    u: 0, speed: 2, load: 3, grain: -1, beta: -1, n: 0, rm: 3, gen: 0,
    x: F(1), y: F(1), vx: F(1), vy: F(1), w: F(1), r: F(1), m: F(1), fx: F(1), fy: F(1), tq: F(1),
    nb: new Int32Array(NMAX * MC).fill(-1), xi: F(MC), sg: new Int32Array(NMAX * MC),
    cn: new Uint8Array(NMAX), cux: new Float32Array(NMAX * MC), cuy: new Float32Array(NMAX * MC),
    cfx: new Float32Array(NMAX * MC), cfy: new Float32Array(NMAX * MC),
    head: new Int32Array(4096), next: new Int32Array(NMAX),
    wi: new Float64Array(2 * NS), wv: new Float64Array(2 * NS), wf: new Float64Array(2 * NS), lean: 0, yp: 0, vp: 0, mp: 1, fp: 0, fw: 0,
    k: 1, c: 0, kt: 1, mg: 1, gw: 1, gh: 1, cs: 8,
    lut: new Float32Array(LN * 3), buf: new Uint8Array(NP * 3), cc: new Float64Array(MC * 4),
  };
}

// Pours a new pile: half small discs and half large ones, 1.3 times wider, so
// the packing stays disordered. The discs are dropped anywhere in the box at
// a fifth of their size and grown while overlapping pairs are pushed apart,
// then the pile settles under gravity and the piston.
function pour(S, grain) {
  S.grain = grain;
  const rm = 3.6 * pow(2, grain - 0.06), rs = rm * 0.87, rl = rm * 1.13;
  S.rm = rm;
  const bw = W + 2 * WOUT, area = 0.82 * bw * (H + 2), n = min(NMAX, Math.round(area / (PI * (rs * rs + rl * rl) * 0.5)));
  const top = H - (H * 0.82) / 0.78;
  S.n = n;
  let mg = 0;
  for (let i = 0; i < n; i++) {
    const r = i & 1 ? rs : rl;
    S.r[i] = r;
    S.m[i] = r * r;
    S.x[i] = -WOUT + r + Math.random() * (bw - 2 * r);
    S.y[i] = top + r + Math.random() * (H - top - 2 * r);
    S.vx[i] = S.vy[i] = S.w[i] = 0;
    mg += r * r * G;
  }
  S.nb.fill(-1);
  S.mg = mg;
  S.cs = 2 * rl + 0.01;
  S.gw = floor((W + 8) / S.cs) + 1;
  S.gh = floor((H + 200) / S.cs) + 1;
  for (let it = 0; it < 90; it++) grow(S, min(1, 0.2 + it / 50), top);
  // Stiffness and damping scale with the weight pressure on the floor, so a
  // contact squeezes the same share of a radius whatever the grain.
  S.k = (KS * mg) / W;
  S.kt = KT * S.k;
  S.c = 2 * ZETA * sqrt(S.k * rm * rm * 0.5);
  S.mp = (0.15 * mg) / G;
  let ymin = H;
  for (let i = 0; i < n; i++) ymin = min(ymin, S.y[i] - S.r[i]);
  S.yp = ymin;
  S.vp = 0;
  S.wi.fill(-WOUT);
  S.wv.fill(0);
  press(S, 0);
  for (let i = 0; i < 50 * SUB; i++) step(S, 1 / 30 / SUB, 8, false);
}

// One pass of growing: radii at share s of their size, every overlapping
// pair pushed apart by its overlap, half each, and the walls pushing back.
function grow(S, s, top) {
  const { n, x, y, r, head, next } = S;
  const cs = S.cs, gw = S.gw, gh = S.gh, off = 200;
  head.fill(-1, 0, gw * gh);
  for (let i = 0; i < n; i++) {
    const o = cl(floor((y[i] + off) / cs), 0, gh - 1) * gw + cl(floor((x[i] + 4) / cs), 0, gw - 1);
    next[i] = head[o];
    head[o] = i;
  }
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++)
      for (let i = head[gy * gw + gx]; i >= 0; i = next[i])
        for (let dy = 0; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx < 0) continue;
            const hx = gx + dx, hy = gy + dy;
            if (hx < 0 || hx >= gw || hy >= gh) continue;
            for (let j = dy === 0 && dx === 0 ? next[i] : head[hy * gw + hx]; j >= 0; j = next[j]) {
              const ddx = x[j] - x[i], ddy = y[j] - y[i], rr = (r[i] + r[j]) * s, d2 = ddx * ddx + ddy * ddy;
              if (d2 >= rr * rr) continue;
              const d = sqrt(d2) || 1e-6, p = (0.5 * (rr - d)) / d;
              x[i] -= ddx * p;
              y[i] -= ddy * p;
              x[j] += ddx * p;
              y[j] += ddy * p;
            }
          }
  for (let i = 0; i < n; i++) {
    const ri = r[i] * s;
    x[i] = cl(x[i], ri - WOUT, W + WOUT - ri);
    y[i] = cl(y[i], top + ri, H - ri);
  }
}

// The slot that holds the tangential spring between disc a and body id, made
// if there is none and room for one.
function slot(S, a, id) {
  const nb = S.nb, b0 = a * MC;
  let free = -1;
  for (let o = b0; o < b0 + MC; o++) {
    if (nb[o] === id) return o;
    if (nb[o] < 0 && free < 0) free = o;
  }
  if (free >= 0) (nb[free] = id), (S.xi[free] = 0);
  return free;
}

// The tangential force on the second body of a contact that slid vt h along
// its tangent, from the spring held in slot o: it slips past MU times fn.
function fric(S, o, vt, fn, h, cd) {
  if (o < 0) return 0;
  let xi = S.xi[o] + vt * h, ft = -S.kt * xi - TD * cd * vt;
  const lim = MU * fn;
  if (ft > lim) (ft = lim), (xi = -lim / S.kt);
  else if (ft < -lim) (ft = -lim), (xi = lim / S.kt);
  S.xi[o] = xi;
  S.sg[o] = S.gen;
  return ft;
}

// Keeps a contact for drawing: the direction from the disc's centre to it
// and the force on the disc there.
function keepC(S, i, ux, uy, fx, fy) {
  if (S.cn[i] >= MC) return;
  const o = i * MC + S.cn[i]++;
  S.cux[o] = ux;
  S.cuy[o] = uy;
  S.cfx[o] = fx;
  S.cfy[o] = fy;
}

// One physics step of h seconds, after Cundall and Strack: touching discs
// push apart with a spring and a damper along the line between them and hold
// each other with a tangential spring that slips past Coulomb friction. The
// walls and the floor do the same. The piston is a heavy lid pushed down
// with force S.fp, and each wall plate is pushed in with S.fw.
function step(S, h, drag, keep) {
  const { n, x, y, vx, vy, w, r, m, fx, fy, tq, head, next, nb, sg, k, c } = S;
  const cs = S.cs, gw = S.gw, gh = S.gh, off = 200, gen = ++S.gen, cd0 = c / (S.rm * 0.7071);
  head.fill(-1, 0, gw * gh);
  for (let i = 0; i < n; i++) {
    fx[i] = 0;
    fy[i] = m[i] * G;
    tq[i] = 0;
    const o = cl(floor((y[i] + off) / cs), 0, gh - 1) * gw + cl(floor((x[i] + 4) / cs), 0, gw - 1);
    next[i] = head[o];
    head[o] = i;
  }
  if (keep) S.cn.fill(0);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++)
      for (let i = head[gy * gw + gx]; i >= 0; i = next[i])
        for (let dy = 0; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx < 0) continue;
            const hx = gx + dx, hy = gy + dy;
            if (hx < 0 || hx >= gw || hy >= gh) continue;
            for (let j = dy === 0 && dx === 0 ? next[i] : head[hy * gw + hx]; j >= 0; j = next[j]) {
              const a = i < j ? i : j, b = i < j ? j : i;
              const ddx = x[b] - x[a], ddy = y[b] - y[a], rr = r[a] + r[b], d2 = ddx * ddx + ddy * ddy;
              if (d2 >= rr * rr) continue;
              const d = sqrt(d2) || 1e-6, nx = ddx / d, ny = ddy / d, ov = rr - d;
              const rvx = vx[b] - vx[a], rvy = vy[b] - vy[a], vn = rvx * nx + rvy * ny;
              const vt = -rvx * ny + rvy * nx - w[b] * r[b] - w[a] * r[a];
              const cd = cd0 * sqrt((m[a] * m[b]) / (m[a] + m[b]));
              const fs = k * ov, fn = max(0, fs - cd * vn), ft = fric(S, slot(S, a, b), vt, fn, h, cd);
              const Fx = fn * nx - ft * ny, Fy = fn * ny + ft * nx;
              fx[b] += Fx;
              fy[b] += Fy;
              fx[a] -= Fx;
              fy[a] -= Fy;
              tq[a] -= r[a] * ft;
              tq[b] -= r[b] * ft;
              if (keep) {
                const Kx = fs * nx - ft * ny, Ky = fs * ny + ft * nx;
                keepC(S, a, nx, ny, -Kx, -Ky);
                keepC(S, b, -nx, -ny, Kx, Ky);
              }
            }
          }
  // Walls: m is the direction from the disc to the wall, the wall moves at
  // (wx, wy).
  let up = 0;
  const yp = S.yp, wi = S.wi, wv = S.wv, wf = S.wf;
  wf.fill(0);
  const wall = (i, id, ov, mx, my, wx, wy) => {
    const ri = r[i], cd = cd0 * sqrt(m[i]), rvx = vx[i] - wx, rvy = vy[i] - wy;
    const vn = rvx * mx + rvy * my, vt = -rvx * my + rvy * mx + w[i] * ri;
    const fs = k * ov, fn = max(0, fs + cd * vn), ft = fric(S, slot(S, i, id), vt, fn, h, cd);
    fx[i] += -fn * mx - ft * my;
    fy[i] += -fn * my + ft * mx;
    tq[i] += ri * ft;
    if (keep) keepC(S, i, mx, my, -fs * mx - ft * my, -fs * my + ft * mx);
    return fn;
  };
  for (let i = 0; i < n; i++) {
    const ri = r[i];
    const sl = cl(floor((y[i] * NS) / H), 0, NS - 1), sr = sl + NS;
    let ov = ri - (x[i] - wi[sl]);
    if (ov > 0) wf[sl] += wall(i, WALL, ov, -1, 0, wv[sl], 0);
    ov = ri - (W - wi[sr] - x[i]);
    if (ov > 0) wf[sr] += wall(i, WALL + 1, ov, 1, 0, -wv[sr], 0);
    ov = ri - (H - y[i]);
    if (ov > 0) wall(i, WALL + 2, ov, 0, 1, 0, 0);
    ov = ri - (y[i] - yp);
    if (ov > 0) up += wall(i, WALL + 3, ov, 0, -1, 0, S.vp);
  }
  // Springs whose contact broke this step are let go.
  for (let o = 0, e = n * MC; o < e; o++) if (nb[o] >= 0 && sg[o] !== gen) nb[o] = -1;
  const dmp = 1 - drag * h;
  for (let i = 0; i < n; i++) {
    vx[i] = (vx[i] + (fx[i] / m[i]) * h) * dmp;
    vy[i] = (vy[i] + (fy[i] / m[i]) * h) * dmp;
    w[i] = (w[i] + ((2 * tq[i]) / (m[i] * r[i] * r[i])) * h) * dmp;
    x[i] += vx[i] * h;
    y[i] += vy[i] * h;
  }
  const pd = 1 - PD * h;
  S.vp = (S.vp + ((S.fp - up) / S.mp) * h) * pd;
  S.yp += S.vp * h;
  // The wall plates move inward at wv and halt at their stops. The top plate
  // also holds the pile above the panel's top edge.
  const mw = S.mp / NS;
  for (let k = 0; k < 2 * NS; k++) {
    const f = S.fw * (k < NS ? 1 + S.lean : 1 - S.lean) * (k % NS ? 1 : 1 - (yp * NS) / H);
    wv[k] = (wv[k] + ((f - wf[k]) / mw) * h) * pd;
    wi[k] += wv[k] * h;
    if (wi[k] < -WOUT) (wi[k] = -WOUT), (wv[k] = max(0, wv[k]));
    if (wi[k] > WIN) (wi[k] = WIN), (wv[k] = min(0, wv[k]));
  }
}

// The pushes at point q of the round, 0 with the piston pressing hardest and
// 1 with the walls pressing hardest. A pressure of 1 is the weight of the
// pile spread over the floor.
function press(S, q) {
  const p = (S.load * S.mg) / W;
  S.fp = p * (SY0 + (SY1 - SY0) * q) * (W - S.wi[0] - S.wi[NS]);
  S.fw = (p * (SX0 + (SX1 - SX0) * q) * H) / NS;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const beta = cl(kv[0], 0, 1) * PI * 0.5;
  if (abs(beta - S.beta) > 0.004) buildLut(S, beta);
  S.speed = cl(kv[1], 0.2, 3);
  S.load = 3 * pow(2, cl(kv[2], -1, 1));
  const grain = cl(kv[3], 0, 1);
  if (S.grain < 0 || abs(grain - S.grain) > 0.03) pour(S, grain), (S.u = 0);
  const h = 1 / 30 / SUB, steps = max(1, Math.round(d * 30 * SUB)), du = (d * S.speed) / 2 / steps;
  for (let i = 0; i < steps; i++) {
    S.u = (S.u + du) % (2 * T_R);
    // The round: the piston pressing hard with the walls easing off, then the
    // walls squeezing while the piston eases, and back. The lean turns over
    // once every two rounds.
    press(S, 0.5 - 0.5 * cos((2 * PI * S.u) / T_R));
    S.lean = LEAN * sin((PI * S.u) / T_R);
    step(S, h, DRAG, i === steps - 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { n, x, y, r, cn, cux, cuy, cfx, cfy, lut, buf, cc } = S;
  buf.fill(0);
  // LUT steps per unit of stress: the weight pressure on the floor makes FR
  // of a fringe.
  const ks = (L0 * W * FR) / (S.mg * LS);
  for (let i = 0; i < n; i++) {
    const R = r[i], cx = x[i], cy = y[i], nc = cn[i], R2 = R * R, Ri = (R - 0.7) * (R - 0.7);
    for (let k = 0; k < nc; k++) {
      const o = i * MC + k;
      cc[k * 4] = R * cux[o];
      cc[k * 4 + 1] = R * cuy[o];
      cc[k * 4 + 2] = cfx[o];
      cc[k * 4 + 3] = cfy[o];
    }
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const ex0 = px + 0.5 - cx, ey0 = py + 0.5 - cy, q = ex0 * ex0 + ey0 * ey0;
        if (q >= R2) continue;
        let cr = 0, cg = 0, cb = 0;
        for (let sub = 0; sub < 4; sub++) {
          const ex = ex0 + (sub & 1 ? 0.25 : -0.25), ey = ey0 + (sub & 2 ? 0.25 : -0.25);
          let sxx = 0, syy = 0, sxy = 0;
          for (let k = 0; k < nc * 4; k += 4) {
            const dx = ex - cc[k], dy = ey - cc[k + 1];
            const r2 = dx * dx + dy * dy + A2, wgt = (cc[k + 2] * dx + cc[k + 3] * dy) / (r2 * r2);
            sxx += wgt * dx * dx;
            syy += wgt * dy * dy;
            sxy += wgt * dx * dy;
          }
          const a = sxx - syy, ds = sqrt(a * a + 4 * sxy * sxy) * (2 / PI);
          const li = min(LN - 1, (ds * ks) | 0) * 3;
          cr += lut[li];
          cg += lut[li + 1];
          cb += lut[li + 2];
        }
        // Four samples a LED, and the rim darkened where the disc's edge bends
        // the light away.
        const f = (q > Ri ? 0.45 : 1) * 0.25, o = (py * W + px) * 3;
        buf[o] = cr * f;
        buf[o + 1] = cg * f;
        buf[o + 2] = cb * f;
      }
  }
  for (let p = 0, yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, p += 3) display.setPixel(xx, yy, buf[p], buf[p + 1], buf[p + 2]);
}
