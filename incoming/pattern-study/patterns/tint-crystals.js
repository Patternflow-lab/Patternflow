// ===== Patternflow pattern =====
// Title:   Tint Crystals
// Family:  cosmetic
// Idea:    Crystals keep nucleating, growing and melting back in a sheer berry tint whose temperature wanders: wherever the tint runs cold a hexagonal plate appears and puts out six arms with glowing tips, its faces catch a slowly circling light, and where the tint warms past its melting point it turns translucent and dissolves.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: anisotropic phase-field model of dendritic solidification (Ryo Kobayashi, 1993), here under a bath temperature that wanders over the panel; collab reference for CLIO, after the Crystal Glam Tint, which retailers describe as a layer of tinted glass
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=-1..1, Facets=-1..1
//
// Knob 1: Hue. Turns the tint round the colour wheel; at 0 it is a raspberry berry, the crystals stay a pale glass of the same hue and one full turn comes back to it.
// Knob 2: Speed. How fast everything runs: at 2 the model takes 8 steps a frame and a cold spot breathes in and out in 8 to 15 seconds; at 0.2 it runs at 0.37 of that, at 3 at 1.35.
// Knob 3: Scale. The size of the crystals, through the interface width and the heat diffusion together: 1.4 times smaller at -1, 1.4 times larger at 1, so low gives many small plates and high a few large stars.
// Knob 4: Facets. How strongly the interface prefers six directions, Kobayashi's delta from 0.006 at -1 through 0.043 at the opening to 0.06 at 1: low grows round grains, the opening hexagonal plates that put out six arms, high sharp six-armed stars with side branches.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, abs, max, min, atan2, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// What is on the panel. phi on every LED of the 64 by 128 torus is 0 in the tint and 1 in a crystal, and T is the latent heat the crystals
// have given out, carried on top of the bath. Kobayashi's 1993 equations move both (step() has them in full). The interface costs more
// energy facing some ways than others, eps = ebar (1 + delta cos 6(theta - theta0)), so a seed grows first as a hexagonal plate and then
// puts out six arms along theta0, and his interface noise sets off side branches. Each crystal draws its own theta0 when it nucleates and
// hands it to the tint it grows into, so neighbours point different ways. The parameters are his (latent heat 1.6, alpha 0.9, gamma 10,
// step 0.3 tau) moved to a grid of one LED, with the interface width and the heat diffusion cut to 0.22 and 0.18 so a star fits the panel.
// The bath keeps it going. Sixteen long waves that fit the torus stand nearly still and each breathes at its own rate; where their sum
// runs high the tint is held up to 0.8 below its melting point, elsewhere up to 0.6 above it. Nuclei appear in cold, empty tint. The bath
// holds each place's heat content (T - K phi) where it sets it, so a cold spot freezes only as far as its undercooling pays for in latent
// heat, half the spot at most, and the crystal stays a plate or a star instead of filling the spot. Where the tint warms past the melting
// point the crystal turns translucent and melts back. A 16 LED square left empty slowly cools, by up to 0.3, until something nucleates in it.

const DT = 0.3; // model step, in units of the relaxation time tau
const K = 1.6; // latent heat
const LAMBDA = 0.004; // how fast the bath takes heat in and out
const NOISE = 0.03; // Kobayashi's interface noise, which sets off side branches
const EB = 0.22; // interface width (Kobayashi's epsilon-bar) at Scale 0
const DIFF = 0.18; // heat diffusion at Scale 0
const UWARM = -0.6; // undercooling of the bath away from the cold spots (below 0 it is above the melting point)
const UCOLD = 0.8; // undercooling at the heart of a cold spot
const F0 = -0.5, F1 = 0.8; // where on the wandering field a cold spot starts and where it is deepest
const LAPK = 0.5; // how much of the bath's own slope the heat runs down
const STEPS = 4; // model steps a frame per unit of Speed
const NM = 16; // bath waves
const IX = 1, IY = 3; // largest wave numbers across and down
const RN = 16, UN = 0.25; // no new crystal within RN LEDs of another; nuclei start to appear at undercooling UN
const RX = 4, RY = 8, LEAN = 0.0004, EMPTY = 0.04; // 16 LED squares; one holding less than EMPTY crystal cools by LEAN a time unit

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function setup(params) {
  const f = () => new Float32Array(N);
  const S = {
    phi: f(), T: f(), u: f(), lu: f(), oc: f(), os: f(), e2: f(), ax: f(), ay: f(), d: f(), glow: f(), h: f(), tmp: f(), tmp2: f(), before: f(),
    mark: new Uint8Array(N), act: new Int32Array(N), na: 0, cy: new Float32Array(H), sy: new Float32Array(H),
    bath: [], t: 0, reg: new Float32Array(RX * RY), share: new Float32Array(RX * RY), warm: false, frac: 0, acc: 0, lt: 0, col: new Float32Array(18), lp: [0, 0, 0], k: [0, 2, 0, 0.06],
  };
  params.s = S;
  return S;
}

// The bath: how far below the melting point the tint is held at each LED.
// Sixteen long waves that fit the 64 by 128 torus stand nearly still and each
// breathes at its own rate; where their sum runs high the tint turns cold.
// A square that has stood empty adds a lean of its own.
function bathField(S) {
  const { u, lu, tmp, cy, sy } = S, t = S.t;
  tmp.fill(0);
  for (const m of S.bath) {
    const ph = m.p + m.v * t, a = m.a * cos(m.w * t + m.q);
    for (let y = 0; y < H; y++) (cy[y] = a * cos(m.ky * y + ph)), (sy[y] = a * sin(m.ky * y + ph));
    for (let y = 0; y < H; y++) {
      const o = y * W, c = cy[y], s = sy[y];
      for (let x = 0; x < W; x++) tmp[o + x] += c * m.cx[x] - s * m.sx[x];
    }
  }
  // plus each region's own lean, read bilinearly off a 4 by 8 grid of 16 LED squares
  const reg = S.reg;
  for (let y = 0; y < H; y++) {
    const gy = y / 16 - 0.5, j0 = floor(gy), fy = gy - j0, ja = ((j0 + RY) % RY) * RX, jb = ((j0 + 1 + RY) % RY) * RX, o = y * W;
    for (let x = 0; x < W; x++) {
      const gx = x / 16 - 0.5, i0 = floor(gx), fx = gx - i0, ia = (i0 + RX) % RX, ib = (i0 + 1 + RX) % RX;
      const r = (reg[ja + ia] * (1 - fx) + reg[ja + ib] * fx) * (1 - fy) + (reg[jb + ia] * (1 - fx) + reg[jb + ib] * fx) * fy;
      u[o + x] = UWARM + r + (UCOLD - UWARM) * sm(F0, F1, tmp[o + x]);
    }
  }
  // its Laplacian: heat runs down the bath's own slopes as well as the latent heat's
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x;
      lu[p] = u[x ? p - 1 : p + W - 1] + u[x < W - 1 ? p + 1 : p - W + 1] + u[om + x] + u[op + x] - 4 * u[p];
    }
  }
}

// The cells where anything can happen this frame: every interface cell and
// two LEDs round it. Everywhere else phi is flat at 0 or 1 and stays there.
function activeCells(S, eb) {
  const { phi, mark, act, e2, ax, ay } = S;
  mark.fill(0);
  for (let y = 0; y < H; y++) {
    const o = y * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, f = phi[p];
      if ((f > 0.002 && f < 0.998) || abs(f - phi[x < W - 1 ? p + 1 : p - W + 1]) > 0.002 || abs(f - phi[op + x]) > 0.002) mark[p] = 1;
    }
  }
  const tmp = S.tmp2;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let d = -2; d <= 2 && !m; d++) m = mark[o + ((x + d + W) % W)];
      tmp[o + x] = m;
    }
  }
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let d = -2; d <= 2 && !m; d++) m = tmp[((y + d + H) % H) * W + x];
      if (m) act[n++] = y * W + x;
    }
  S.na = n;
  e2.fill(eb * eb);
  ax.fill(0);
  ay.fill(0);
}

// One step of Kobayashi's equations on the torus, with T the latent heat
// carried on top of the bath:
//   tau dphi/dt = d/dy(eps eps' dphi/dx) - d/dx(eps eps' dphi/dy) + div(eps^2 grad phi) + phi (1 - phi)(phi - 1/2 + m)
//   dT/dt = D lap T + K dphi/dt - lambda (T - K phi) - LAPK D lap u
// eps = ebar (1 + delta cos 6(theta - theta0)), m = (alpha/2) z / (1 + |z|), z = gamma (u - T),
// a cheaper stand-in for Kobayashi's (alpha/pi) atan z with the same ends (alpha 0.9, gamma 10).
// The lambda term is a bath that holds each place's heat content where the
// bath sets it, so a cold spot freezes only as far as its undercooling pays
// for in latent heat and the crystal stays a star instead of filling the spot.
function step(S, eb, delta, D) {
  const { phi, T, u, lu, oc, os, e2, ax, ay, d, act, na } = S;
  for (let i = 0; i < na; i++) {
    const p = act[i], x = p % W, y = (p - x) / W;
    const xm = x ? p - 1 : p + W - 1, xp = x < W - 1 ? p + 1 : p - W + 1;
    const gx = 0.5 * (phi[xp] - phi[xm]), gy = 0.5 * (phi[((y + 1) % H) * W + x] - phi[((y + H - 1) % H) * W + x]), r2 = gx * gx + gy * gy;
    if (r2 < 1e-9) {
      e2[p] = eb * eb;
      ax[p] = 0;
      ay[p] = 0;
      continue;
    }
    const ir = 1 / sqrt(r2), c = gx * ir, s = gy * ir;
    // (c + i s)^6, turned back by the crystal's own 6 theta0
    const c2 = c * c - s * s, s2 = 2 * c * s, c3 = c2 * c - s2 * s, s3 = c2 * s + s2 * c, c6 = c3 * c3 - s3 * s3, s6 = 2 * c3 * s3;
    const cr = c6 * oc[p] + s6 * os[p], sr = s6 * oc[p] - c6 * os[p];
    const e = eb * (1 + delta * cr), ed = -eb * delta * 6 * sr;
    e2[p] = e * e;
    ax[p] = e * ed * gx;
    ay[p] = e * ed * gy;
  }
  for (let i = 0; i < na; i++) {
    const p = act[i], x = p % W, y = (p - x) / W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W, o = y * W;
    const x0 = x ? x - 1 : W - 1, x1 = x < W - 1 ? x + 1 : 0;
    const pl = o + x0, pr = o + x1, pu = om + x, pd = op + x;
    const f = phi[p], ep = e2[p];
    // div(eps^2 grad phi) on nine points, so the grid adds as little four-fold pull as it can
    const dv =
      (1 / 3) * ((ep + e2[pl]) * (phi[pl] - f) + (ep + e2[pr]) * (phi[pr] - f) + (ep + e2[pu]) * (phi[pu] - f) + (ep + e2[pd]) * (phi[pd] - f)) +
      (1 / 12) * ((ep + e2[om + x0]) * (phi[om + x0] - f) + (ep + e2[om + x1]) * (phi[om + x1] - f) + (ep + e2[op + x0]) * (phi[op + x0] - f) + (ep + e2[op + x1]) * (phi[op + x1] - f));
    const cross = 0.5 * (ax[pd] - ax[pu]) - 0.5 * (ay[pr] - ay[pl]);
    const z = 10 * (u[p] - T[p]), m = (0.45 * z) / (1 + abs(z));
    const g = f * (1 - f);
    d[p] = DT * (dv + cross + g * (f - 0.5 + m + (g > 0.01 ? NOISE * (Math.random() - 0.5) : 0)));
  }
  for (let i = 0; i < na; i++) {
    const p = act[i];
    let f = phi[p] + d[p];
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    T[p] += K * (f - phi[p]);
    phi[p] = f;
  }
  // heat: the bath, then diffusion in as many sub-steps as stability needs
  const lk = DT * LAMBDA, dk = DT * D;
  for (let p = 0; p < N; p++) T[p] -= lk * (T[p] - K * phi[p]) + LAPK * dk * lu[p];
  const sub = Math.ceil(dk / 0.2), h = dk / sub, tn = S.tmp2;
  for (let k = 0; k < sub; k++) {
    for (let y = 0; y < H; y++) {
      const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const p = o + x, tp = T[p];
        tn[p] = tp + h * (T[x ? p - 1 : p + W - 1] + T[x < W - 1 ? p + 1 : p - W + 1] + T[om + x] + T[op + x] - 4 * tp);
      }
    }
    T.set(tn);
  }
}

// Liquid next to a crystal takes that crystal's orientation, so a star keeps
// its own six directions as it grows into the cells around it.
function orient(S) {
  const { phi, oc, os } = S;
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, f = phi[p];
      if (f > 0.9) continue;
      let b = p, bf = f + 0.02;
      const q1 = x ? p - 1 : p + W - 1, q2 = x < W - 1 ? p + 1 : p - W + 1, q3 = om + x, q4 = op + x;
      if (phi[q1] > bf) (b = q1), (bf = phi[q1]);
      if (phi[q2] > bf) (b = q2), (bf = phi[q2]);
      if (phi[q3] > bf) (b = q3), (bf = phi[q3]);
      if (phi[q4] > bf) (b = q4), (bf = phi[q4]);
      if (b !== p) (oc[p] = oc[b]), (os[p] = os[b]);
    }
  }
}

// A new crystal: a small disc in cold, empty tint, with an orientation of its own.
function nucleate(S, tries, rad, rate) {
  const { phi, T, u, oc, os } = S;
  for (let i = 0; i < tries; i++) {
    const cx = floor(Math.random() * W), cy = floor(Math.random() * H), p = cy * W + cx;
    if (Math.random() > rate * sm(UN, UN + 0.45, u[p] - T[p])) continue;
    let busy = false;
    for (let dy = -RN; dy <= RN && !busy; dy += 3)
      for (let dx = -RN; dx <= RN; dx += 3)
        if (phi[((cy + dy + H) % H) * W + ((cx + dx + W) % W)] > 0.05) {
          busy = true;
          break;
        }
    if (busy) continue;
    const a = Math.random() * TAU, ca = cos(a), sa = sin(a), r = Math.ceil(rad + 2);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const q = ((cy + dy + H) % H) * W + ((cx + dx + W) % W), dd = sqrt(dx * dx + dy * dy);
        phi[q] = max(phi[q], 1 - sm(rad - 0.7, rad + 0.7, dd));
        oc[q] = ca;
        os[q] = sa;
      }
  }
}

function knobs(k) {
  const s = Math.pow(1.4, cl(k[2], -1, 1)), f = (cl(k[3], -1, 1) + 1) / 2;
  return { speed: 0.6 + 0.7 * cl(k[1], 0.2, 3), eb: EB * s, D: DIFF * s, delta: 0.006 + 0.054 * Math.pow(f, 0.6), s };
}

function advance(S, steps, P) {
  bathField(S);
  activeCells(S, P.eb);
  for (let i = 0; i < steps; i++) {
    S.t += DT;
    step(S, P.eb, P.delta, P.D);
  }
  orient(S);
  let fr = 0;
  const { share, reg, phi } = S;
  share.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) share[(y >> 4) * RX + (x >> 4)] += phi[y * W + x];
  // a 16 LED square left empty slowly cools until something nucleates in it,
  // and lets the lean go again once it holds crystal
  for (let c = 0; c < RX * RY; c++) {
    share[c] /= 256;
    fr += share[c];
    reg[c] = cl(reg[c] + steps * DT * (share[c] < EMPTY ? LEAN : -4 * LEAN * reg[c]), 0, 0.3);
  }
  S.frac = fr / (RX * RY);
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || [0, 2, 0, 0.06];
  const P = knobs(k);
  S.k = k;
  if (!S.warm) {
    S.warm = true;
    const sg = () => (Math.random() < 0.5 ? -1 : 1);
    for (let j = 0; j < NM; j++) {
      let ix = 0, iy = 0;
      while (!ix && !iy) (ix = floor(Math.random() * (2 * IX + 1)) - IX), (iy = floor(Math.random() * (2 * IY + 1)) - IY);
      const kx = (TAU * ix) / W, ky = (TAU * iy) / H, cx = new Float32Array(W), sx = new Float32Array(W);
      for (let x = 0; x < W; x++) (cx[x] = cos(kx * x)), (sx[x] = sin(kx * x));
      S.bath.push({ kx, ky, cx, sx, a: 1 / (1 + 30 * sqrt(kx * kx + ky * ky)), p: Math.random() * TAU, v: (0.0002 + 0.0004 * Math.random()) * sg(), q: Math.random() * TAU, w: 0.006 + 0.005 * Math.random() });
    }
    let v = 0;
    for (const m of S.bath) v += m.a * m.a;
    for (const m of S.bath) m.a *= 2 / sqrt(v);
    S.lp = [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];
    // grow a panel's worth of crystals before the first frame, nuclei spread over the run so they stand at different ages
    for (let i = 0; i < 100; i++) {
      advance(S, 30, P);
      nucleate(S, 20, 2, 1);
    }
  }
  const ft = cl(dt || 0, 0, 0.1);
  S.acc += ft * 30 * STEPS * P.speed;
  const n = floor(S.acc);
  S.acc -= n;
  const { phi, glow, before } = S;
  before.set(phi);
  if (n > 0) advance(S, n, P);
  nucleate(S, 20, 2, 2 * ft * P.speed);
  // the growing fronts glow and the glow fades over about half a second
  const dk = exp(-ft / 0.5);
  for (let p = 0; p < N; p++) {
    const d = phi[p] - before[p];
    glow[p] = glow[p] * dk + (d > 0 ? d * 5 : 0);
  }
  S.lt += ft * P.speed;
}

function blur(src, dst, tmp) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) tmp[o + x] = (src[o + (x ? x - 1 : W - 1)] + src[o + x] + src[o + (x < W - 1 ? x + 1 : 0)]) / 3;
  }
  for (let y = 0; y < H; y++) {
    const om = ((y + H - 1) % H) * W, o = y * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) dst[o + x] = (tmp[om + x] + tmp[o + x] + tmp[op + x]) / 3;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { phi, T, u, h, tmp, tmp2, glow, oc, os, col } = S;
  const hue = 0.93 + S.k[0];
  hsv(hue, 0.5, 0.6, col, 0); // tint where it is cold and deep
  hsv(hue - 0.01, 0.44, 0.72, col, 3); // tint where it is warm and sheer
  hsv(hue + 0.02, 0.14, 1, col, 6); // a crystal face turned to the light
  hsv(hue + 0.01, 0.4, 0.62, col, 12); // a face turned away, which shows the tint through it
  hsv(hue - 0.03, 0.08, 1, col, 9); // the glow of a growing tip
  // the crystal as a low relief: phi blurred twice
  blur(phi, tmp, tmp2);
  blur(tmp, h, tmp2);
  // the light circles slowly, never twice the same way
  const lt = S.lt, az = S.lp[0] + 0.23 * lt + 0.8 * sin(0.071 * lt + S.lp[1]);
  const el = 0.62 + 0.15 * sin(0.047 * lt + S.lp[2]);
  const lx = cos(az) * cos(el), ly = sin(az) * cos(el), lz = sin(el);
  const hl = 1 / sqrt(lx * lx + ly * ly + (lz + 1) * (lz + 1)), hx = lx * hl, hy = ly * hl, hz = (lz + 1) * hl;
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, xm = x ? p - 1 : p + W - 1, xp = x < W - 1 ? p + 1 : p - W + 1;
      // a crystal in tint warmer than its melting point turns translucent before it goes
      const f = phi[p], fc = sm(0.15, 0.85, f) * (1 - 0.8 * sm(-0.05, 0.3, T[p] - u[p]));
      // the tint: deeper where the bath runs cold, paler in the warm halo the latent heat leaves round a crystal
      const warm = sm(-0.5, 0.6, T[p] - u[p] + 0.3);
      let r = col[0] + (col[3] - col[0]) * warm, g = col[1] + (col[4] - col[1]) * warm, b = col[2] + (col[5] - col[2]) * warm;
      // a broad sheen on the tint, from the slopes of the bath under it
      const lnx = -(u[xp] - u[xm]) * 1.4, lny = -(u[op + x] - u[om + x]) * 1.4, ln = 1 / sqrt(lnx * lnx + lny * lny + 1);
      const ls = (lnx * hx + lny * hy + hz) * ln, sheen = 0.14 * ls * ls * ls * ls * ls * ls;
      r += (1 - r) * sheen;
      g += (1 - g) * sheen;
      b += (1 - b) * sheen;
      if (fc > 0 || h[p] > 0.02) {
        // facets: the slope of the relief, turned to the nearest of the six faces of this crystal
        let nx = -(h[xp] - h[xm]) * 3, ny = -(h[op + x] - h[om + x]) * 3;
        const sl = sqrt(nx * nx + ny * ny);
        if (sl > 1e-4) {
          const t0 = atan2(os[p], oc[p]) / 6 + PI / 6, a = atan2(ny, nx);
          const as = t0 + (PI / 3) * round((a - t0) / (PI / 3)), mix = sm(0.3, 0.9, f);
          nx = nx * (1 - mix) + sl * cos(as) * mix;
          ny = ny * (1 - mix) + sl * sin(as) * mix;
        }
        const nn = 1 / sqrt(nx * nx + ny * ny + 1);
        const dif = (nx * lx + ny * ly + lz) * nn, nh = max(0, (nx * hx + ny * hy + hz) * nn);
        const sh = sm(0.35, 1, dif), n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, spec = n8 * n8 * n4;
        const cr = col[12] + (col[6] - col[12]) * sh, cg = col[13] + (col[7] - col[13]) * sh, cb = col[14] + (col[8] - col[14]) * sh;
        r += (cr - r) * fc;
        g += (cg - g) * fc;
        b += (cb - b) * fc;
        // a bright rim where glass meets tint, and the glint
        const rim = 0.2 * sm(0.05, 0.4, f) * (1 - sm(0.6, 0.95, f)) + 0.85 * spec * (0.3 + 0.7 * fc);
        r += (1 - r) * rim;
        g += (1 - g) * rim;
        b += (1 - b) * rim;
      }
      const gw = min(1, glow[p]) * 0.8;
      r += (col[9] - r) * gw;
      g += (col[10] - g) * gw;
      b += (col[11] - b) * gw;
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(g, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
  }
}
