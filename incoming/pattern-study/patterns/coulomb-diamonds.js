// ===== Patternflow pattern =====
// Title:   Coulomb Diamonds
// Family:  coulombblockade
// Idea:    The differential-conductance map of a single-electron transistor: gate voltage runs across the panel and source-drain bias runs down it with zero at the middle row, so the dot's blockaded diamonds are a chain of dark indigo rhombi of different sizes whose edges are bright cyan ridges meeting on the zero-bias row, with excited-state lines running parallel outside them, a magenta line of negative conductance beside some, and a violet haze where the dot conducts, while the window pans along the gate axis, a slow magnetic field moves the levels and flips which diamonds are big, charge noise jumps the whole map sideways, and temperature smears the ridges until the diamonds close.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Coulomb blockade diamonds of a quantum dot in the constant-interaction model, the n-th conductance peak at n times the charging energy plus the n-th single-particle level, diamond n half as tall as its addition energy (Kouwenhoven and colleagues 1997, "Electron transport in quantum dots", from memory), spin-degenerate levels that split by Zeeman energy in a field, the Kondo ridge at zero bias in odd diamonds, negative differential conductance beside an excited-state line; the pan, noise and field sweep and the colours are original, pattern round 243
// Round:   243
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Charging=1..5, Temperature=1..8, Asymmetry=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the diamonds are near-black indigo, the ridges run from deep blue through cyan to white, the negative-conductance lines are magenta and the conducting haze outside is violet; at 0.5 the ridges are orange and the haze is olive.
// Knob 2: Charging. 1 to 5, opening at 2. The charging energy: the addition energy of a diamond is the charging energy plus whatever level spacing the next electron has to pay. At 1 a diamond is 10 to 28 LED wide and four or five are in view. At 5 a diamond is 34 to 52 wide and two fill the panel. Rhombi never repeat, the even ones (a level fills) stand wider than the odd ones.
// Knob 3: Temperature. 1 to 8, opening at 1. The thermal width of every ridge, 2 LED across at 1 and 9 at 8. Cold, the lines are sharp and bright and the Kondo ridge shows at zero bias in odd diamonds. Warm, the lines widen and dim, the excited-state lines and the magenta ones run together, the Kondo ridge is gone and the dark rhombi shrink and close up.
// Knob 4: Asymmetry. -1 to 1, opening near 0. The ratio of source to drain capacitance: one pair of edges is steeper than the other and the rhombi lean. At -1 the left edges are the shallow ones and the top vertex sits near the left corner, at 1 it sits near the right corner. At 0 the lean is slight, as in a real device.

const W = 64, H = 128, BMID = 63.5;
const { floor, ceil, round, min, max, abs, exp, sqrt, sin, cos, tanh, log, pow, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const P0 = 2.0;                       // mean slope of the diamond edges, bias rows per gate column
const D0 = 8.5, CS = 8, ZS = 7;       // level spacing, orbital shift and Zeeman splitting at full field, in gate columns
const EC0 = 10, EC1 = 34;             // charging energy at Charging 1 and 5, in gate columns
const TABN = 48, TABL = 176;          // table of sech^2, 48 steps a unit
const TAB = new Float32Array(TABL + 2);
for (let i = 0; i < TAB.length; i++) {
  const x = i / TABN, c = (exp(x) + exp(-x)) / 2;
  TAB[i] = 1 / (c * c);
}
const FAR = new Float32Array(H);
for (let y = 0; y < H; y++) FAR[y] = exp(-pow((BMID - y) / 58, 2));
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ---- colour -----------------------------------------------------------------
function oklab(L, C, hdeg, out) {
  const h = (hdeg * PI) / 180, a = C * cos(h), b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
const inGamut = (c) => c[0] >= -0.001 && c[1] >= -0.001 && c[2] >= -0.001 && c[0] <= 1.001 && c[1] <= 1.001 && c[2] <= 1.001;
function rgbOf(L, C, h, out, o, k) {
  const c = [0, 0, 0];
  oklab(L, C, h, c);
  if (!inGamut(c)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      oklab(L, mid, h, c);
      if (inGamut(c)) lo = mid;
      else hi = mid;
    }
    oklab(L, lo, h, c);
  }
  out[o] = 255 * k * enc(cl(c[0], 0, 1));
  out[o + 1] = 255 * k * enc(cl(c[1], 0, 1));
  out[o + 2] = 255 * k * enc(cl(c[2], 0, 1));
}
// three tables for one hue turn: the positive ridge (blue to cyan to white), the negative ridge (magenta), the ground (indigo to violet haze)
function buildLuts(st, hr) {
  const pos = st.lutP, neg = st.lutN, gr = st.lutG;
  for (let i = 0; i < 256; i++) {
    const v = i / 255, fade = sstep(0.02, 0.3, v);
    rgbOf(0.3 + 0.68 * v, 0.17 * (1 - 0.8 * sstep(0.62, 1, v)), 258 - 62 * sstep(0, 0.6, v) + hr, pos, i * 3, fade);
    rgbOf(0.28 + 0.56 * v, 0.21 * (1 - 0.6 * sstep(0.7, 1, v)), 342 - 14 * v + hr, neg, i * 3, fade);
  }
  for (let i = 0; i < 64; i++) {
    const t = i / 63;
    rgbOf(0.125 + 0.2 * t, 0.075 + 0.075 * t, 274 + 24 * t + hr, gr, i * 3, 1);
  }
}

// ---- the dot ----------------------------------------------------------------
// Orbital j holds two electrons (spin up and down). Its energy is O[j] (a running sum of random spacings, now and then a big
// one where a shell closes) plus C[j] times the field, and the spin pair splits by Zg[j] times the field. The n-th conductance
// peak sits at n times the charging energy plus the n-th lowest spin-orbital: width of diamond n is Ec + s(n+1) - s(n).
function ensureJ(st, j) {
  while (st.O.length <= j) {
    const jj = st.O.length;
    let w = sqrt((-4 / PI) * log(1 - rnd() * 0.999));
    w = cl(w, 0.3, 2.2);
    if (rnd() < 0.3) w *= 1.8;
    st.O.push((jj ? st.O[jj - 1] : 0) + D0 * w);
    st.C.push((rnd() * 2 - 1) * CS);
    st.Zg.push(ZS * (0.65 + 0.7 * rnd()));
  }
}
const G0 = (st, n) => n * st.Ec + st.O[(n - 1) >> 1];

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 1, 0.06], init: false, t: 0, hue: -9,
    Ec: 20, fw: 2, as: 0.2, B: 0, X0: 0, ncI: 0, xo: 0, u: 0,
    O: [], C: [], Zg: [], S: new Float32Array(96),
    ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    tl: [{ s: 0, next: 1 + 4 * rnd() }, { s: 0, next: 1 + 4 * rnd() }],
    hvx: new Float32Array(W), gx: new Float32Array(96), hh: new Float32Array(96), e1: new Float32Array(96), e2: new Float32Array(96),
    P: new Float32Array(W * H), Q: new Float32Array(W * H), V: new Float32Array(W * H),
    lutP: new Float32Array(256 * 3), lutN: new Float32Array(256 * 3), lutG: new Float32Array(64 * 3),
  });
  return st;
}

function targets(k) {
  return {
    hue: cl(k[0], 0, 1),
    Ec: EC0 * pow(EC1 / EC0, cl((k[1] - 1) / 4, 0, 1)),
    fw: cl(k[2], 1, 8) + 1,
    as: cl(k[3], -1, 1) * 0.85 + 0.2,
  };
}

// the field: three sines whose periods share no factor, squashed into 0..1 and bent so it sits low most of the time
function fieldAt(st, t) {
  const s = 0.55 * sin((TAU * t) / 33 + st.ph[0]) + 0.45 * sin((TAU * t) / 53.3 + st.ph[1]) + 0.3 * sin((TAU * t) / 89.7 + st.ph[2]);
  return pow(0.5 + 0.5 * tanh(1.3 * s), 1.8);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const tg = targets(st.k);
  if (!st.init) {
    st.init = true;
    st.Ec = tg.Ec; st.fw = tg.fw; st.as = tg.as;
    ensureJ(st, 400);
    st.ncI = 16 + floor(rnd() * 20);
    st.X0 = G0(st, st.ncI) + rnd() * st.Ec;
    st.t = 0;
    st.B = fieldAt(st, 0);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  const ks = 1 - exp(-dt / 0.25), kq = 1 - exp(-dt / 0.2);
  // charging energy: the map is scaled about the diamond in the middle, so the picture opens and closes on it
  const dEc = (tg.Ec - st.Ec) * ks;
  st.Ec += dEc;
  st.X0 += st.ncI * dEc;
  st.fw += (tg.fw - st.fw) * kq;
  st.as += (tg.as - st.as) * kq;
  st.B = fieldAt(st, st.t);
  // the pan: 1 to 2 columns a second, with a slow mean-reverting wander, never backwards
  st.u += (-st.u / 20) * dt + 0.35 * sqrt(0.1) * sqrt(dt) * gauss();
  st.X0 += 1.7 * (1 + cl(st.u, -0.5, 0.45)) * dt;
  ensureJ(st, ((st.ncI + 40) >> 1) + 4);
  while (G0(st, st.ncI + 1) < st.X0) st.ncI++;
  while (st.ncI > 4 && G0(st, st.ncI) > st.X0) st.ncI--;
  // charge noise: two telegraph switches, each held one to five seconds, jump the whole map a fraction of a diamond
  const wbar = st.Ec + 4.5;
  let tgt = 0;
  const amp = [0.24, 0.13];
  for (let i = 0; i < 2; i++) {
    const tl = st.tl[i];
    if (st.t >= tl.next) {
      tl.s ^= 1;
      tl.next = st.t + 1 + 4 * rnd();
    }
    tgt += tl.s * amp[i] * wbar;
  }
  st.xo += (tgt - st.xo) * (1 - exp(-dt / 0.07));
}

// ---- drawing ----------------------------------------------------------------
// a ridge in one row: sech^2 of the distance to the line, which has slope dx/dbias = m, scaled by the thermal width a
function ridge(buf, y, xc, k, amp, a) {
  const hw = (3.4 * a) / k;
  let x0 = ceil(xc - hw - 0.5), x1 = floor(xc + hw - 0.5);
  if (x1 < 0 || x0 > W - 1) return;
  if (x0 < 0) x0 = 0;
  if (x1 > W - 1) x1 = W - 1;
  const sc = (k / a) * TABN, row = y * W;
  for (let x = x0; x <= x1; x++) {
    const d = abs(x + 0.5 - xc) * sc;
    buf[row + x] += amp * TAB[d | 0];
  }
}
const hz = (st, n) => 0.4 + 0.9 * hsh(n, 17, 4) * (0.75 + 0.25 * sin((TAU * st.t) / (31 + 11 * hsh(n, 2, 8)) + 6.28 * hsh(n, 6, 1)));
const bump = (b, lo, hi) => sstep(lo - 3, lo + 3, b) * (1 - sstep(hi - 3, hi + 3, b));
const hsh = (n, a, k) => {
  let h = Math.imul(n + 7919, 374761393) ^ Math.imul(a + 3, 668265263) ^ Math.imul(k + 11, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function frame(st) {
  const { P, Q, V, gx, hh, e1, e2 } = st;
  P.fill(0); Q.fill(0); V.fill(0);
  const Ec = st.Ec, nc = st.ncI, fw = st.fw, a = fw / 1.76, B = st.B;
  const p1 = P0 * exp(0.7 * st.as), p2 = P0 * exp(-0.7 * st.as);
  const mp = 1 / p1, mn = 1 / p2, kp = 1 / sqrt(1 + mp * mp), kn = 1 / sqrt(1 + mn * mn);
  const hf = (p1 * p2) / (p1 + p2), ef = 2 * hf;       // half-height per gate column, and bias per level energy
  const tamp = pow(1.14 / a, 0.45);                       // the line dims as it widens
  // the levels in this window, in field B
  const NS = min(13, ceil(150 / (Ec + 4)));
  const nlo = max(5, nc - NS), nhi = nc + NS;
  const jlo = max(0, ((nlo - 1) >> 1) - 3), jhi = ((nhi + 3) >> 1) + 3;
  const S = st.S, nj = jhi - jlo + 1, m = 2 * nj;
  for (let j = 0; j < nj; j++) {
    const e = st.O[jlo + j] + st.C[jlo + j] * B, z = 0.5 * st.Zg[jlo + j] * B;
    S[2 * j] = e - z;
    S[2 * j + 1] = e + z;
  }
  for (let i = 1; i < m; i++) {
    const v = S[i];
    let j = i - 1;
    while (j >= 0 && S[j] > v) { S[j + 1] = S[j]; j--; }
    S[j + 1] = v;
  }
  const cnt = nhi - nlo + 1;
  const sOf = (n) => S[cl(n - 1 - 2 * jlo, 0, m - 1)];
  for (let i = 0; i <= cnt + 1; i++) {
    const n = nlo + i;
    gx[i] = 32 + (n * Ec + sOf(n) - st.X0) + st.xo;
    e1[i] = ef * (sOf(n + 1) - sOf(n));
    e2[i] = ef * (sOf(n + 2) - sOf(n));
  }
  for (let i = 0; i <= cnt; i++) hh[i] = (gx[i + 1] - gx[i]) * hf;
  // how strongly the dot conducts between two peaks: its own value for each interval, blended across the peak
  for (let x = 0, i = 0; x < W; x++) {
    const xp = x + 0.5;
    while (i < cnt && gx[i + 1] < xp) i++;
    const h0 = hz(st, nlo + i), h1 = hz(st, nlo + i + 1), t = sstep(0, 1, (xp - gx[i]) / max(1, gx[i + 1] - gx[i]));
    st.hvx[x] = h0 + (h1 - h0) * t;
  }
  const sep = 6 + 2 * a;
  const kon = 0.5 * (1 - sstep(0.2, 0.55, B)) * (1 - sstep(3.5, 7, fw));
  const shr = 0.3 * fw, we = 0.9 + 1.0 * a;

  for (let i = 0; i <= cnt; i++) {
    const xs = gx[i], hn = hh[i], hp = i ? hh[i - 1] : hn, n = nlo + i, xn = gx[i + 1];
    // each peak has its own height, and it breathes on its own slow clock
    const an = (0.6 + 0.6 * hsh(n, 9, 9)) * (1 + 0.22 * sin((TAU * st.t) / (23 + 14 * hsh(n, 5, 5)) + TAU * hsh(n, 3, 3)));
    // ground lines through the degeneracy point: up-right and down-right arms, bright where they bound a diamond
    for (let y = 0; y < H; y++) {
      const b = BMID - y, far = FAR[y] * 0.24;
      const x1 = xs + b * mp, x2 = xs - b * mn;
      if (x1 > -8 && x1 < W + 8) { const sg = bump(b, -hp, hn); ridge(P, y, x1, kp, tamp * an * (sg + (1 - sg) * far), a); }
      if (x2 > -8 && x2 < W + 8) { const sg = bump(b, -hn, hp); ridge(P, y, x2, kn, tamp * an * (sg + (1 - sg) * far), a); }
    }
    // excited-state lines, parallel to an arm and starting on the other arm
    for (let arm = 0; arm < 2; arm++) {
      const mm = arm ? mn : mp, kk = arm ? kn : kp, pa = arm ? p2 : p1, pb = arm ? p1 : p2;
      for (let k = 1; k <= 2; k++) {
        const e = k === 1 ? e1[i] : e2[i];
        if (e > 60) continue;
        const ndc = hsh(n, arm, k) < (k === 1 ? 0.32 : 0.24);
        const amp = tamp * an * (k === 1 ? 0.5 : 0.32) * (arm ? 0.8 : 1);
        for (let pass = 0; pass < (ndc ? 2 : 1); pass++) {
          const ee = pass ? e + sep : e, ys = (ee * pb) / (pa + pb), buf = pass ? Q : P, am = pass ? amp * 1.25 : amp;
          // above zero bias (b > 0) the line is the arm raised by ee, below it lowered
          for (let y = 0; y < H; y++) {
            const b = BMID - y, ab = abs(b);
            if (ab < ys - 1) continue;
            const f = sstep(ys - 1, ys + 5, ab) * exp(-(ab - ys) / 36);
            let xc;
            if (b > 0) xc = arm ? xs + (ee - b) * mm : xs + (b - ee) * mm;
            else xc = arm ? xs - (b + ee) * mm : xs + (b + ee) * mm;
            if (xc > -8 && xc < W + 8) ridge(buf, y, xc, kk, am * f, a);
          }
        }
      }
    }
    // the diamond itself, as a dark coverage with the edges softened by the temperature
    if (i < cnt) {
      for (let y = 0; y < H; y++) {
        const b = BMID - y, ab = abs(b);
        let lo, hi;
        if (b >= 0) { lo = xs + ab * mp; hi = xn - ab * mn; }
        else { lo = xs + ab * mn; hi = xn - ab * mp; }
        lo += shr; hi -= shr;
        if (hi < lo - 2 * we) continue;
        let x0 = floor(lo - we), x1 = ceil(hi + we);
        if (x1 < 0 || x0 > W - 1) continue;
        if (x0 < 0) x0 = 0;
        if (x1 > W - 1) x1 = W - 1;
        const row = y * W;
        for (let x = x0; x <= x1; x++) {
          const xp = x + 0.5;
          V[row + x] += sstep(lo - we, lo + we, xp) * (1 - sstep(hi - we, hi + we, xp));
        }
      }
      // the Kondo ridge: zero bias, odd electron number, cold and in a weak field only
      if ((n & 1) && kon > 0.01) {
        for (let y = 61; y <= 66; y++) {
          const b = BMID - y, w = kon * exp(-0.5 * (b / 1.15) * (b / 1.15));
          if (w < 0.02) continue;
          const lo = xs + 3, hi = xn - 3, row = y * W;
          for (let x = max(0, floor(lo - 3)); x <= min(W - 1, ceil(hi + 3)); x++) {
            const xp = x + 0.5;
            P[row + x] += w * sstep(lo - 3, lo + 3, xp) * (1 - sstep(hi - 3, hi + 3, xp));
          }
        }
      }
    }
  }
  // out: indigo where the dot is blockaded, violet haze where it conducts, ridges screened over it
}

export function draw(display, params) {
  if (!params.st) setup(params);
  const st = params.st;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const tg = targets(st.k);
  if (abs(tg.hue - st.hue) > 1e-4) {
    st.hue = tg.hue;
    buildLuts(st, 360 * tg.hue);
  }
  frame(st);
  const { P, Q, V, lutP, lutN, lutG, hvx } = st;
  const leak = 0.02 + 0.3 * sstep(3, 9, st.fw);
  for (let y = 0; y < H; y++) {
    const b = abs(BMID - y) / BMID, hb = 0.5 + 0.3 * b;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, d = BAYER[((y & 3) << 2) | (x & 3)];
      const c = 1 - min(1, V[i]) * (1 - leak);
      const gi = ((cl(c * hb * hvx[x], 0, 1) * 63 + 0.5) | 0) * 3;
      let r = lutG[gi], g = lutG[gi + 1], bl = lutG[gi + 2];
      const pv = 1 - exp(-1.1 * P[i]), qv = 1 - exp(-1.2 * Q[i]);
      if (pv > 0.004) {
        const pi = ((pv > 1 ? 1 : pv) * 255 + 0.5 | 0) * 3;
        r = 255 - ((255 - r) * (255 - lutP[pi])) / 255;
        g = 255 - ((255 - g) * (255 - lutP[pi + 1])) / 255;
        bl = 255 - ((255 - bl) * (255 - lutP[pi + 2])) / 255;
      }
      if (qv > 0.004) {
        const qi = ((qv > 1 ? 1 : qv) * 255 + 0.5 | 0) * 3;
        r = 255 - ((255 - r) * (255 - lutN[qi])) / 255;
        g = 255 - ((255 - g) * (255 - lutN[qi + 1])) / 255;
        bl = 255 - ((255 - bl) * (255 - lutN[qi + 2])) / 255;
      }
      display.setPixel(x, y, cl(floor(r + d), 0, 255), cl(floor(g + d), 0, 255), cl(floor(bl + d), 0, 255));
    }
  }
}
