// ===== Patternflow pattern =====
// Title:   Bath Fizz
// Family:  cosmetic
// Idea:    Seen through bath water, fizzing powder somewhere below the panel sends up clouds of saturated pigment in three colours that billow up the 128 rows and roll over into mushroom caps, running into each other at their edges, while streams of fine bubbles rise through them and drag the colour up with them.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 35, after underwater film of a fizzing bath powder clouding the water
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fizz=0..1, Mix=0..1
//
// Knob 1: Hue. Turns the three pigments and the deep water round the whole wheel together, opening on pink, violet and aqua. A pigment that lands between orange and lime is laid paler and brighter, peach or butter, and thins to a pale haze, and water that would go brown turns deep indigo.
// Knob 2: Speed. How fast the water moves: at 2 a bubble crosses the 128 rows in about four seconds and a cloud's colour thins away over five; at 0.2 everything runs ten times slower.
// Knob 3: Fizz. How hard the powder fizzes: at 0 a gentle chug of about 60 bubbles a second and a puff from each colour every 1.6 s, the first cloud reaching the top 20 rows after 7.6 s; at 1 about 360 bubbles a second, a puff every 0.8 s, and the first cloud is up there in 2.4 s.
// Knob 4: Mix. How far the colours run into each other: at 0 the strongest pigment takes each LED up to a seam a LED or two wide; at 1 the pigments spread nine times as fast and blend where they overlap, so pink and aqua meet in lilac.
// Buttons: K1 tap sets off a fresh burst: all three colours at once across the bottom and a rush of bubbles.

const W = 64, H = 128, N = W * H;
// The water is worked out on a grid of 2x2 LEDs; the pigment is carried at
// full resolution through it, so the clouds keep a fine edge.
const GW = 32, GH = 64, GN = GW * GH;
const MAXB = 1200;
// Deep indigo, given at full brightness like the water colour it replaces.
const INDIGO = [0.34, 0.3, 1];
const { min, max, floor, sqrt, sin, cos, exp, abs, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5);
  out[o + 1] = f(3);
  out[o + 2] = f(1);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    U: F(GN), V: F(GN), U0: F(GN), V0: F(GN), P: F(GN), DV: F(GN), L: F(GN), L0: F(GN), CU: F(GN), FB: F(GN),
    A: [F(N), F(N), F(N)], TA: F(N), PI0: new Int32Array(N), PF: F(2 * N), BB: F(N), BT: F(N), DD: F(N),
    bx: F(MAXB), by: F(MAXB), bs: F(MAXB), bp: F(MAXB), nb: 0,
    // Three places along the bottom where the powder fizzes, one per colour.
    src: [0, 1, 2].map((c) => ({ c, ph: (2 * PI * c) / 3 + rnd(), w: [0.11, 0.07, 0.09][c], next: 0.2 + 0.5 * c, puff: 0, bacc: 0 })),
    T: 0, RS: F(W), RC: F(W), PW: F(256), pe: 0, hue: 0, speed: 2, fizz: 0, mix: 0.06, started: false, col: F(20), key: NaN,
  };
}

// Bilinear read of a grid field at grid coordinates.
function samp(F, x, y) {
  x = cl(x, 0, GW - 1.001);
  y = cl(y, 0, GH - 1.001);
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, i = iy * GW + ix;
  return (F[i] * (1 - fx) + F[i + 1] * fx) * (1 - fy) + (F[i + GW] * (1 - fx) + F[i + GW + 1] * fx) * fy;
}

// A soft round blob added to a full-resolution field.
function blob(A, cx, cy, r, w) {
  const x0 = max(0, floor(cx - 2 * r)), x1 = min(W - 1, floor(cx + 2 * r)), y0 = max(0, floor(cy - 2 * r)), y1 = min(H - 1, floor(cy + 2 * r));
  const k = 1 / (r * r);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      A[y * W + x] += w * exp(-(dx * dx + dy * dy) * k);
    }
}

function gblob(G, cx, cy, r, w) {
  // The same on the water's grid, given in LEDs.
  const gx = cx / 2, gy = cy / 2, gr = r / 2, k = 1 / (gr * gr);
  for (let y = max(0, floor(gy - 2 * gr)); y <= min(GH - 1, floor(gy + 2 * gr)); y++)
    for (let x = max(0, floor(gx - 2 * gr)); x <= min(GW - 1, floor(gx + 2 * gr)); x++) {
      const dx = x + 0.5 - gx, dy = y + 0.5 - gy;
      G[y * GW + x] += w * exp(-(dx * dx + dy * dy) * k);
    }
}

function bubbles(S, x, n, spread) {
  for (let j = 0; j < n && S.nb < MAXB; j++) {
    const i = S.nb++;
    S.bx[i] = x + (rnd() + rnd() - 1) * spread;
    S.by[i] = H + 1 + rnd() * 4;
    S.bs[i] = rnd();
    S.bp[i] = rnd() * 2 * PI;
  }
}

// A burst from one place: pigment and lift at the bottom, and its bubbles.
function puff(S, s, x, k) {
  blob(S.A[s.c], x, H - 2, 5 + 2 * k, 5.4 * k);
  gblob(S.L, x, H - 3, 6 + 2 * k, 2.2 * k);
}

function burst(S) {
  for (const s of S.src) {
    const x = 6 + rnd() * 52;
    puff(S, s, x, 2.2);
    bubbles(S, x, 70, 5);
  }
}

function fluid(S, st) {
  const U = S.U, V = S.V, U0 = S.U0, V0 = S.V0, L = S.L, L0 = S.L0, P = S.P, DV = S.DV, CU = S.CU, FB = S.FB, f = S.fizz;
  // Forces: the lift the fizz leaves in the water, and the drag of each
  // rising bubble on the water round it.
  const buoy = 34 * (1 + 0.9 * f);
  for (let i = 0; i < GN; i++) {
    V[i] -= st * (buoy * L[i] + 7 * FB[i]);
    FB[i] = 0;
  }
  // Vorticity confinement keeps the small curls that roll a cloud's edge over.
  for (let y = 1; y < GH - 1; y++)
    for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x;
      CU[i] = 0.5 * (V[i + 1] - V[i - 1] - U[i + GW] + U[i - GW]);
    }
  const eps = 2.2;
  for (let y = 2; y < GH - 2; y++)
    for (let x = 2; x < GW - 2; x++) {
      const i = y * GW + x;
      const nx = 0.5 * (abs(CU[i + 1]) - abs(CU[i - 1])), ny = 0.5 * (abs(CU[i + GW]) - abs(CU[i - GW])), nl = sqrt(nx * nx + ny * ny) + 1e-5;
      U[i] += st * eps * (ny / nl) * CU[i];
      V[i] -= st * eps * (nx / nl) * CU[i];
    }
  // Carry the water along itself.
  U0.set(U);
  V0.set(V);
  L0.set(L);
  const fade = exp(-st / 2.4);
  for (let y = 0, i = 0; y < GH; y++)
    for (let x = 0; x < GW; x++, i++) {
      const px = x - st * U0[i], py = y - st * V0[i];
      U[i] = samp(U0, px, py) * 0.995;
      V[i] = samp(V0, px, py) * 0.995;
      L[i] = samp(L0, px, py) * fade;
    }
  // Walls all round: the sides of the bath, its floor below the panel and the
  // surface above.
  for (let y = 0; y < GH; y++) {
    U[y * GW] = U[y * GW + GW - 1] = 0;
  }
  for (let x = 0; x < GW; x++) {
    V[x] = V[(GH - 1) * GW + x] = 0;
  }
  // Make it incompressible: what rises in the middle comes down at the sides.
  for (let y = 0, i = 0; y < GH; y++)
    for (let x = 0; x < GW; x++, i++) {
      const ur = x < GW - 1 ? U[i + 1] : 0, ul = x > 0 ? U[i - 1] : 0, vd = y < GH - 1 ? V[i + GW] : 0, vu = y > 0 ? V[i - GW] : 0;
      DV[i] = 0.5 * (ur - ul + vd - vu);
    }
  for (let it = 0; it < 24; it++)
    for (let y = 0, i = 0; y < GH; y++)
      for (let x = 0; x < GW; x++, i++) {
        const p = P[i];
        const s = (x > 0 ? P[i - 1] : p) + (x < GW - 1 ? P[i + 1] : p) + (y > 0 ? P[i - GW] : p) + (y < GH - 1 ? P[i + GW] : p);
        P[i] = p + 1.6 * ((s - DV[i]) / 4 - p);
      }
  for (let y = 0, i = 0; y < GH; y++)
    for (let x = 0; x < GW; x++, i++) {
      const p = P[i];
      U[i] -= 0.5 * ((x < GW - 1 ? P[i + 1] : p) - (x > 0 ? P[i - 1] : p));
      V[i] -= 0.5 * ((y < GH - 1 ? P[i + GW] : p) - (y > 0 ? P[i - GW] : p));
    }
}

function pigment(S, st) {
  const U = S.U, V = S.V, TA = S.TA, mix = S.mix, PI0 = S.PI0, PF = S.PF;
  // The pigment is carried by the water, read at each LED's own place so it
  // stays half a cell finer than the water. The trace back is worked out once
  // for all three pigments.
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const gx = (x + 0.5) / 2 - 0.5, gy = (y + 0.5) / 2 - 0.5;
      const px = cl(x - 2 * st * samp(U, gx, gy), 0, W - 1.001), py = cl(y - 2 * st * samp(V, gx, gy), 0, H - 1.001);
      const ix = floor(px), iy = floor(py);
      PI0[i] = iy * W + ix;
      PF[2 * i] = px - ix;
      PF[2 * i + 1] = py - iy;
    }
  // Then it spreads a little, more the higher Mix, and slowly thins into the bath.
  const kap = cl(st * (0.6 + 5 * mix), 0, 0.24), fade = exp(-st / 5);
  for (const A of S.A) {
    TA.set(A);
    for (let i = 0; i < N; i++) {
      const j = PI0[i], fx = PF[2 * i], fy = PF[2 * i + 1];
      A[i] = (TA[j] * (1 - fx) + TA[j + 1] * fx) * (1 - fy) + (TA[j + W] * (1 - fx) + TA[j + W + 1] * fx) * fy;
    }
    TA.set(A);
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) {
        const c = TA[i];
        const l = (x > 0 ? TA[i - 1] : c) + (x < W - 1 ? TA[i + 1] : c) + (y > 0 ? TA[i - W] : c) + (y < H - 1 ? TA[i + W] : c) - 4 * c;
        A[i] = (c + kap * l) * fade;
      }
  }
}

function step(S, st) {
  S.T += st;
  const f = S.fizz;
  for (const s of S.src) {
    // Each place wanders along the bottom as the powder tumbles, each at its
    // own pace, so now and then two pass and their clouds go up together.
    s.ph += st * s.w;
    const x = 32 + 22 * sin(s.ph) + 4 * sin(2.7 * s.ph + s.c);
    s.next -= st;
    if (s.next <= 0) {
      s.puff = 0.8 + 0.6 * rnd();
      s.next = (1.6 - 0.8 * f) * (0.6 + 0.8 * rnd());
    }
    s.puff *= exp(-st / 0.3);
    const k = st * (0.5 + 0.4 * f + 4 * s.puff);
    puff(S, s, x, k);
    s.bacc += st * (30 + 110 * f) * (0.5 + s.puff);
    const nb = floor(s.bacc);
    s.bacc -= nb;
    bubbles(S, x, nb, 1.5 + 1.5 * s.puff);
  }
  // Bubbles: small ones rise slower and zig-zag more, all ride the water
  // sideways, and each pulls the water up with it.
  const U = S.U, V = S.V, FB = S.FB;
  let k = 0;
  for (let i = 0; i < S.nb; i++) {
    let x = S.bx[i], y = S.by[i];
    const s = S.bs[i], gx = x / 2 - 0.5, gy = y / 2 - 0.5;
    const ph = (S.bp[i] += st * (7 + 5 * (1 - s)));
    const rise = (24 + 20 * s) * (0.85 + 0.5 * f);
    x += st * (1.2 * samp(U, gx, gy) + (2 + 3 * (1 - s)) * cos(ph));
    y += st * (2 * samp(V, gx, gy) * 0.6 - rise);
    if (y < -1 || x < -1 || x > W + 1) continue;
    const ci = cl(floor(y / 2), 0, GH - 1) * GW + cl(floor(x / 2), 0, GW - 1);
    FB[ci] += 0.5 + 0.5 * s;
    S.bx[k] = x;
    S.by[k] = y;
    S.bs[k] = s;
    S.bp[k] = S.bp[i];
    k++;
  }
  S.nb = k;
  fluid(S, st);
  pigment(S, st);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1], 0.2, 3);
  S.fizz = cl(kv[2] || 0, 0, 1);
  S.mix = cl(kv[3], 0, 1);
  if (!S.started) {
    S.started = true;
    // Open with the water already clouding: six and a half seconds of fizz,
    // in coarse steps.
    for (let i = 0; i < 80; i++) step(S, 1 / 12);
  }
  if (input.btnPressed && input.btnPressed[0]) burst(S);
  step(S, (d * S.speed) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const col = S.col, mix = S.mix, A0 = S.A[0], A1 = S.A[1], A2 = S.A[2], T = S.T;
  // Palette: three pigments spread round the wheel from the hue, and deep
  // water. A pigment from orange to lime is paled and its cloud thickens
  // faster, because those hues at half brightness read brown and olive.
  const h0 = S.hue + 0.92, key = h0 + 3 * mix;
  if (S.key !== key) {
    const hs = [h0, h0 - 0.17, h0 - 0.42];
    for (let c = 0; c < 3; c++) {
      const hf = hs[c] - floor(hs[c]), wm = sm((hf - 0.02) / 0.05) * (1 - sm((hf - 0.24) / 0.06));
      hsv(hs[c], 0.95 - 0.45 * wm, 1, col, c * 3);
      col[9 + c] = 4.5 * (1 + wm);
      col[16 + c] = wm;
    }
    // Deep water opposite the pigments; where that lands on orange or gold it
    // would be brown, so there the water turns deep indigo.
    const hw = h0 - 0.32, hf = hw - floor(hw), wm = sm((hf + 0.02) / 0.06) * (1 - sm((hf - 0.27) / 0.08));
    hsv(hw, 0.8, 1, col, 12);
    for (let c = 0; c < 3; c++) col[12 + c] += (INDIGO[c] - col[12 + c]) * wm;
    S.key = key;
  }
  // Bubbles: splatted, then a 3x3 blur so each is a soft bump two or three
  // LEDs across rather than a hard dot.
  const BB = S.BB, BT = S.BT;
  BB.fill(0);
  for (let i = 0; i < S.nb; i++) {
    const x = S.bx[i] - 0.5, y = S.by[i] - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, w = 0.7 + 0.5 * S.bs[i];
    if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) continue;
    const p = iy * W + ix;
    BB[p] += w * (1 - fx) * (1 - fy);
    BB[p + 1] += w * fx * (1 - fy);
    BB[p + W] += w * (1 - fx) * fy;
    BB[p + W + 1] += w * fx * fy;
  }
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) BT[i] = (x > 0 ? BB[i - 1] : 0) + 2 * BB[i] + (x < W - 1 ? BB[i + 1] : 0);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) BB[i] = ((y > 0 ? BT[i - W] : 0) + 2 * BT[i] + (y < H - 1 ? BT[i + W] : 0)) / 16;
  // How sharply the strongest pigment takes a LED: at Mix 0 it takes it up to
  // a narrow seam, at 1 the pigments add.
  const pe = 1 + 7 * (1 - mix) * (1 - mix), PW = S.PW;
  if (S.pe !== pe) {
    for (let j = 0; j < 256; j++) PW[j] = pow((j + 0.5) / 255, pe);
    PW[255] = 1;
    S.pe = pe;
  }
  const DD = S.DD;
  for (let i = 0; i < N; i++) DD[i] = A0[i] + A1[i] + A2[i];
  // Slow shafts of light slant down through the water from the surface:
  // sin(a(x) + 0.08 y), split so each row and column is worked out once.
  const RS = S.RS, RC = S.RC;
  for (let x = 0; x < W; x++) {
    const a = 0.16 * x + 0.5 * T + 1.2 * sin(0.05 * x - 0.3 * T);
    RS[x] = sin(a);
    RC[x] = cos(a);
  }
  for (let y = 0, i = 0; y < H; y++) {
    // The water: light from the surface, falling off towards the floor.
    const wl = 0.1 + 0.08 * exp(-y / 40), wr = 0.25 * wl * exp(-y / 70), sy = sin(0.08 * y), cy = cos(0.08 * y);
    for (let x = 0; x < W; x++, i++) {
      const a0 = A0[i], a1 = A1[i], a2 = A2[i], D = DD[i];
      const lw = wl + wr * (1 + RS[x] * cy + RC[x] * sy);
      let r = col[12] * lw, g = col[13] * lw, b = col[14] * lw;
      if (D > 0.002) {
        // Each pigment's weight is its share of the strongest, to the power pe.
        const am = a0 > a1 ? (a0 > a2 ? a0 : a2) : a1 > a2 ? a1 : a2, iv = 1 / am;
        const q0 = a0 * iv, q1 = a1 * iv, q2 = a2 * iv;
        const w0 = PW[(q0 * 255) | 0], w1 = PW[(q1 * 255) | 0], w2 = PW[(q2 * 255) | 0];
        const ws = w0 + w1 + w2;
        let cr = (w0 * col[0] + w1 * col[3] + w2 * col[6]) / ws, cg = (w0 * col[1] + w1 * col[4] + w2 * col[7]) / ws, cb = (w0 * col[2] + w1 * col[5] + w2 * col[8]) / ws;
        // Opacity goes with the cube of the pigment, e^3 / (e^3 + 1): half at
        // e = 1, nine tenths at e = 2 and nearly clear below a half, so old
        // colour thins away and fresh clouds stand out on the water.
        const e = a0 * col[9] + a1 * col[10] + a2 * col[11], e3 = e * e * e, op = e3 / (e3 + 1);
        // A thinning cloud of orange, gold or lime would dim through brown and
        // olive, so as it thins it pales towards a grey haze instead.
        const wp = ((w0 * col[16] + w1 * col[17] + w2 * col[18]) / ws) * (1 - op * op);
        cr += (0.8 - cr) * wp;
        cg += (0.8 - cg) * wp;
        cb += (0.8 - cb) * wp;
        // Light from above catches the top of each billow and the cloud is
        // brighter where it is thick.
        const up = y > 1 ? D - DD[i - 2 * W] : 0;
        const lv = cl(0.76 + 0.25 * (1 - exp(-2 * D)) + 0.35 * up, 0.5, 1);
        r += (cr * lv - r) * op;
        g += (cg * lv - g) * op;
        b += (cb * lv - b) * op;
      }
      const bb = min(0.55, BB[i]);
      r += bb * (1 - 0.4 * r);
      g += bb * (1 - 0.4 * g);
      b += bb * (1 - 0.4 * b);
      display.setPixel(x, y, 255 * min(1, r), 255 * min(1, g), 255 * min(1, b));
    }
  }
}
