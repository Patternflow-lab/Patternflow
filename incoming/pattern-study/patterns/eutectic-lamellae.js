// ===== Patternflow pattern =====
// Title:   Eutectic Lamellae
// Family:  eutectic
// Idea:    A two-phase alloy is pulled through a furnace and the window rides the growth front: a hot white-yellow front with scalloped grooves sits near the top, and below it the solid streams down as alternating copper and steel-blue plates that are the front's own history, with plates splitting in a Y where they grow too wide, ending in a point where they are squeezed out, and leaning and fanning with the front.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the eutectic, a melt that freezes at one temperature into two phases (Frederick Guthrie, 1884), and the theory of lamellar eutectic growth, whose spacing falls with the pull speed to the power minus one half (Kenneth Jackson and J. D. Hunt, 1966), with the branching and elimination of lamellae that keeps the spacing near its optimum; pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pull=0.8..5, Fraction=0.35..0.75, Tilt=-1..1
//
// Knob 1: Hue. Turns both phases round the wheel together, the second phase always opposite the first. At 0 the first phase is copper orange and the second steel blue; at 0.33 green and violet, at 0.5 teal and red-orange.
// Knob 2: Pull. The pull speed. The window scrolls 2.2 LEDs a second per unit, so 4.4 LEDs a second at the opening 2 (a plate takes 26 s to cross the panel), 1.8 at 0.8 and 11 at 5. The optimum pair spacing is 14 LEDs times the square root of 2 over the pull: 18 LEDs at 1, 14 at 2, 9 at 4.4. After a turn the plates split to a finer spacing, or the extra ones are squeezed out to a coarser one, over about 10 to 30 LEDs of growth (3 to 10 s).
// Knob 3: Fraction. The share of the second phase, 0.3 to 0.75. At 0.3 the blue plates are thin, about 4 LEDs between copper plates of about 10; at 0.5 they are equal; at 0.75 the copper is the thin one. Turning it makes the thin phase die out and the other split until the widths fit.
// Knob 4: Tilt. How far the front's temperature gradient leans. 0 leaves the plates upright apart from the sway the wavy front gives them; at 1 they lean 0.75 LEDs sideways for every LED of growth (37 degrees), more on one side of the panel than the other so they fan, and the sign picks the side they lean to. A fan opening up makes splits, one closing makes terminations.

const W = 64, H = 128;
const L = 64; // the sample is a ring as wide as the panel, so plates leaving at one edge come back at the other
const RH = 2, DS = 1 / RH; // history rows per LED of growth, and one step of growth
const HR = 256, HM = HR - 1; // history ring, in rows
const Y0 = 12; // row of the front when it is flat
const SP = 2.2; // LEDs of scroll a second per unit of Pull
const LAM0 = 16; // optimum spacing of a pair of plates at Pull 2
const H0 = 0.062; // Hue 0 lands on copper
const KR = 0.04; // how fast neighbouring plates trade width
const SHR = 0.25; // how fast a dying plate closes, each side, per LED of growth
const YOUNG = 18; // LEDs of growth before a plate may split or die again
const LOCAL = 0.12; // how far the wanted spacing varies across the front
const { floor, ceil, abs, sqrt, sin, cos, exp, pow, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const TAU = 2 * PI;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => sqrt(-2 * Math.log(r() + 1e-9)) * cos(TAU * r());

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, q, p, p, t, v][i], [t, v, v, q, p, p][i], [p, p, t, v, v, q][i]];
}

export function setup(params) {
  const r = rng(2241);
  params.s = {
    ready: false, t: 0, acc: 0, head: 0, rho: 0, rnd: r,
    v: 2, f: 0.35, tilt: 0.06, wv: 0, ve: 2, hue: 0,
    lam: [],
    P: new Float32Array(HR * W), Lm: new Float32Array(HR * W), D: new Float32Array(HR * W),
    cb: new Float32Array(W), ls: new Float32Array(W), us: new Float32Array(W), ws: new Float32Array(W),
    ov: new Float32Array(W), dk: new Float32Array(W),
    rowU: new Float32Array(W), rowG: new Float32Array(W),
    w: new Float32Array(64), rr: new Float32Array(64), dx: new Float32Array(64), st: new Float32Array(64),
    // phases of the three front waves, of the wanted-spacing noise, and of the fan
    mp: [r() * TAU, r() * TAU, r() * TAU], np: [r() * TAU, r() * TAU, r() * TAU], fan: r() * TAU, sw: [r() * TAU, r() * TAU],
    lamOpt: LAM0,
    nSplit: 0, nElim: 0,
  };
}

// ---- the front: its wave, the lean of the plates and the spacing they are asked for

const MA = [2.6, 1.3, 0.6]; // LEDs of the front's waves, 64, 32 and 21 LEDs long

function frontWave(S, x) {
  const g = 1 + 0.75 * abs(S.tilt);
  let d = 0;
  for (let m = 0; m < 3; m++) d += MA[m] * g * (1 + 0.3 * sin(S.t * (0.043 + 0.019 * m) + m * 2.1)) * sin((TAU * (m + 1) * x) / L + S.mp[m]);
  return d;
}

function frontSlope(S, x) {
  const g = 1 + 0.75 * abs(S.tilt);
  let d = 0;
  for (let m = 0; m < 3; m++) {
    const k = (TAU * (m + 1)) / L;
    d += MA[m] * g * k * (1 + 0.3 * sin(S.t * (0.043 + 0.019 * m) + m * 2.1)) * cos(k * x + S.mp[m]);
  }
  return d;
}

// Plates grow along the normal of the front, so where the front slopes they lean with it: u is the sideways
// step per LED of growth. A slow sway of the temperature field adds a drift of its own, 0.2 at most, and the knob
// adds a lean that is stronger on one side than the other.
function lean(S, x) {
  const k = (TAU * x) / L;
  return 1.0 * frontSlope(S, x) + 0.14 * sin(k + S.sw[0]) + 0.08 * sin(2 * k + S.sw[1]) + 0.7 * S.tilt * (1 + 0.4 * sin(k + S.fan));
}

// How much finer or coarser than the optimum the front asks for at x, -1 to 1.
function want(S, x) {
  const k = (TAU * x) / L;
  return (sin(2 * k + S.np[0]) + 0.8 * sin(3 * k + S.np[1]) + 0.5 * sin(5 * k + S.np[2])) / 2.3;
}

// ---- the plates

// The plates are a ring of lamellae: each has the x of its left boundary (unwrapped, so it may leave 0..64), the
// phase (0 copper, 1 blue), its age in LEDs of growth, whether it is being squeezed out and a sideways drift.
function seedPlates(S) {
  const r = S.rnd, lam = S.lam;
  const pairs = max(3, Math.round(L / S.lamOpt));
  const n = pairs * 2, ws = [];
  let tot = 0;
  for (let i = 0; i < n; i++) {
    const w = (i & 1 ? S.f : 1 - S.f) * (0.55 + 0.95 * r());
    ws.push(w);
    tot += w;
  }
  let x = 0, ph = r() < 0.5 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    lam.push({ x, ph, age: YOUNG + r() * 20, bs: 1, dying: false, vn: 0 });
    x += (ws[i] / tot) * L;
    ph = 1 - ph;
  }
}

function measure(S) {
  const { lam, w, rr } = S, N = lam.length, f = S.f, lo = S.lamOpt;
  for (let i = 0; i < N; i++) {
    const nx = i + 1 < N ? lam[i + 1].x : lam[0].x + L;
    w[i] = nx - lam[i].x;
    const xm = lam[i].x + 0.5 * w[i];
    const t = (lam[i].ph ? f : 1 - f) * lo * (1 + LOCAL * want(S, xm));
    rr[i] = cl(w[i] / t, 0.15, 2.6);
  }
}

function removeAt(S, i) {
  const lam = S.lam, N = lam.length;
  if (i === N - 1) {
    lam.splice(N - 1, 1);
    lam.splice(0, 1);
  } else lam.splice(i, 2);
  // the plate that closed over starts again, so it is not split at once for being wide
  lam[i === 0 || i === N - 1 ? lam.length - 1 : i - 1].age = 0;
  S.nElim++;
}

function step(S) {
  const lam = S.lam, r = S.rnd;
  let N = lam.length;
  measure(S);
  // births and deaths. A plate far over its wanted width may split with a new plate of the other phase near its
  // centre; one far under it starts to close. The small base rates keep some of it going when everything fits.
  const splits = [];
  for (let i = 0; i < N; i++) {
    const p = lam[i], rt = S.rr[i];
    p.age += DS;
    if (p.bs < 1) p.bs = min(1, p.bs + DS / 6);
    if (p.age < YOUNG || p.dying) continue;
    const pS = DS * (0.0012 * sm(0.8, 1.1, rt) + 0.22 * sm(1.35, 1.9, rt));
    const pE = DS * (0.0012 * sm(1.2, 0.9, rt) + 0.22 * sm(0.7, 0.35, rt));
    const q = r();
    if (q < pS) splits.push(i);
    else if (q < pS + pE) p.dying = true;
  }
  for (let k = splits.length - 1; k >= 0; k--) {
    if (lam.length > 26) break;
    const i = splits[k], p = lam[i];
    const nx = i + 1 < lam.length ? lam[i + 1].x : lam[0].x + L;
    const wd = nx - p.x;
    const c = p.x + wd * (0.5 + 0.07 * gauss(r));
    lam.splice(
      i + 1, 0,
      { x: c - 0.3, ph: 1 - p.ph, age: 0, bs: 0, dying: false, vn: p.vn },
      { x: c + 0.3, ph: p.ph, age: 0, bs: 0, dying: false, vn: p.vn },
    );
    S.nSplit++;
  }
  N = lam.length;
  if (splits.length) measure(S);
  // motion of every boundary: the two plates beside it trade width toward their wanted ratio, the lean carries it
  // sideways, a slow wander bends it, and a dying plate closes
  const dx = S.dx, rr = S.rr, lo = S.lamOpt;
  for (let i = 0; i < N; i++) {
    const il = i === 0 ? N - 1 : i - 1, p = lam[i];
    let d = 0;
    // a plate that is closing is not pushed back by its neighbours
    if (!p.dying && !lam[il].dying) d = cl(KR * lo * DS * (rr[i] - rr[il]), -0.3, 0.3);
    p.vn += -(p.vn * DS) / 15 + 0.02 * gauss(r);
    d += DS * (p.vn + lean(S, p.x));
    if (p.dying) d += SHR * DS;
    if (lam[il].dying) d -= SHR * DS;
    dx[i] = d;
  }
  for (let i = 0; i < N; i++) lam[i].x += dx[i];
  for (let i = 1; i < N; i++) if (lam[i].x < lam[i - 1].x + 0.02) lam[i].x = lam[i - 1].x + 0.02;
  if (lam[N - 1].x > lam[0].x + L - 0.02) lam[N - 1].x = lam[0].x + L - 0.02;
  // a plate squeezed to nothing leaves and its two neighbours join
  for (let guard = 0; guard < 4 && lam.length > 6; guard++) {
    let hit = -1;
    for (let i = 0; i < lam.length; i++) {
      const nx = i + 1 < lam.length ? lam[i + 1].x : lam[0].x + L;
      if (nx - lam[i].x < 0.3 && lam[i].age > 1) {
        hit = i;
        break;
      }
    }
    if (hit < 0) break;
    removeAt(S, hit);
  }
  while (lam[0].x >= L) for (const p of lam) p.x -= L;
  while (lam[0].x < 0) {
    const p = lam.shift();
    p.x += L;
    lam.push(p);
  }
  S.rho += DS;
  raster(S);
}

// One row of the solid, put at the top of the history: the share of the second phase, the lightness across each
// plate (lit from the upper left, so each plate reads as rounded), and the dark line along each boundary.
function raster(S) {
  const { lam, cb, ls, us, ws, ov, dk } = S, N = lam.length;
  cb.fill(0); ls.fill(0); us.fill(0); ws.fill(0); ov.fill(0); dk.fill(0);
  // How sharply each boundary is drawn. It fades in as a new plate is born and out as a plate is squeezed thin, so
  // that when a plate vanishes its edges are already gone and nothing steps.
  const st = S.st;
  for (let i = 0; i < N; i++) {
    const il = i === 0 ? N - 1 : i - 1;
    const wl = lam[i].x - lam[il].x + (i === 0 ? L : 0), wr = (i + 1 < N ? lam[i + 1].x : lam[0].x + L) - lam[i].x;
    st[i] = lam[i].bs * sm(0.3, 1.6, min(wl, wr));
  }
  for (let i = 0; i < N; i++) {
    const nl = i + 1 < N ? lam[i + 1] : lam[0];
    const a = lam[i].x, b = i + 1 < N ? nl.x : nl.x + L, wd = b - a, mid = a + wd / 2, half = wd / 2 + 1e-6;
    const ph = lam[i].ph, base = ph ? 0.7 : 0.76, sl = st[i], sr = st[i + 1 < N ? i + 1 : 0];
    for (let k = -1; k <= 1; k++) {
      const A = a + k * L, B = b + k * L;
      if (B > 0 && A < W) {
        const p0 = max(0, floor(A)), p1 = min(W - 1, ceil(B) - 1);
        for (let p = p0; p <= p1; p++) {
          const lo = max(A, p), hi = min(B, p + 1), o = hi - lo;
          if (o <= 0) continue;
          const cx = (lo + hi) / 2, u = (cx - (mid + k * L)) / half;
          // the plate is flat across its middle and turns over in the last 2 or 3 LEDs at each edge, lit from the left
          // (the distance to the edge, not the share of the width, so a plate that widens or splits does not jump)
          const eL = sl * exp(-(cx - A) / 2.5), eR = sr * exp(-(B - cx) / 2.5);
          const gL = sl * exp(-(cx - A) / 8), gR = sr * exp(-(B - cx) / 8);
          const lt = base + 0.32 * (1 - max(eL, eR)) + 0.1 * (eL - eR) + 0.12 * (gL - gR);
          ov[p] += o;
          if (ph) cb[p] += o;
          ls[p] += o * lt;
          us[p] += o * u;
          ws[p] += o * wd;
        }
      }
      const c = a + k * L;
      if (c > -1.2 && c < W + 1.2)
        for (let p = max(0, floor(c - 1.1)); p <= min(W - 1, floor(c + 1.1)); p++) {
          const v = (1 - abs(p + 0.5 - c) / 1.1) * sl;
          if (v > dk[p]) dk[p] = v;
        }
    }
  }
  S.head = (S.head - 1) & HM;
  const base = S.head * W, rho = S.rho;
  for (let p = 0; p < W; p++) {
    const o = ov[p] || 1;
    // light that wanders over the sample, a few percent
    const tn = 0.04 * sin(0.21 * p + 0.083 * rho + 1) + 0.03 * sin(0.113 * p - 0.057 * rho + 2) + 0.025 * sin(0.37 * p + 0.031 * rho);
    S.P[base + p] = cb[p] / o;
    S.Lm[base + p] = ls[p] / o + tn;
    S.D[base + p] = dk[p];
    S.rowU[p] = us[p] / o;
    S.rowG[p] = ws[p] / o;
  }
}

function advance(S, dt) {
  S.t += dt;
  const a = 1 - exp(-dt / 0.9), b = 1 - exp(-dt / 1.4);
  S.v += (S.vT - S.v) * a;
  S.f += (S.fT - S.f) * b;
  S.tilt += (S.tiltT - S.tilt) * a;
  // the pull speed wanders by a random walk around the knob, a quarter either way over about half a minute
  S.wv += -(S.wv * dt) / 30 + 0.22 * sqrt((2 * dt) / 30) * gauss(S.rnd);
  S.wv = cl(S.wv, -0.5, 0.5);
  S.ve = S.v * exp(S.wv);
  S.lamOpt = LAM0 * sqrt(2 / S.ve);
  S.mp[0] += 0.12 * dt; S.mp[1] -= 0.17 * dt; S.mp[2] += 0.23 * dt;
  S.np[0] += 0.061 * dt; S.np[1] -= 0.089 * dt; S.np[2] += 0.127 * dt;
  S.fan += 0.071 * dt;
  S.sw[0] += 0.043 * dt; S.sw[1] -= 0.067 * dt;
  S.acc += (SP * S.ve * dt) / DS;
  const n = floor(S.acc);
  S.acc -= n;
  for (let k = 0; k < n; k++) step(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kn[0] + H0;
  S.vT = cl(kn[1], 0.8, 5);
  S.fT = cl(kn[2], 0.35, 0.75);
  S.tiltT = cl(kn[3], -1, 1);
  if (!S.ready) {
    // the sample is already growing when the panel opens, with the knobs where they stand
    S.v = S.vT; S.f = S.fT; S.tilt = S.tiltT;
    S.ve = S.v;
    S.lamOpt = LAM0 * sqrt(2 / S.ve);
    seedPlates(S);
    for (let g = 0; g < 4000 && S.rho < 380; g++) advance(S, 0.1);
    S.acc = 0;
    S.ready = true;
    return;
  }
  advance(S, d);
}

// ---- drawing

const HOT = [255, 236, 172];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const ca = hsv(S.hue, 0.64, 1), cb = hsv(S.hue + 0.52, 0.42, 0.9), cl2 = hsv(S.hue - 0.01, 0.85, 1);
  const hot = [mix(HOT[0], ca[0] * 255, 0.12), mix(HOT[1], ca[1] * 255, 0.12), mix(HOT[2], ca[2] * 255, 0.12)];
  const { P, Lm, D, rowU, rowG } = S, off = S.acc;
  const t = S.t;
  for (let x = 0; x < W; x++) {
    const gro = 1.5 * sm(0.8, 5, rowG[x]) * pow(abs(rowU[x]), 1.3);
    const F = Y0 + frontWave(S, x + 0.5) + gro;
    for (let y = 0; y < H; y++) {
      const fd = y + 0.5 - F;
      let r, g, b;
      const sol = sm(-0.6, 0.6, fd);
      if (sol > 0) {
        // the solid: the history row this pixel sits on, found from its depth below the flat front
        let jf = (y + 0.5 - Y0 - off * DS) * RH;
        if (jf < 0) jf = 0;
        else if (jf > HR - 2.01) jf = HR - 2.01;
        const j0 = floor(jf), fr = jf - j0;
        const i0 = ((S.head + j0) & HM) * W + x, i1 = ((S.head + j0 + 1) & HM) * W + x;
        const pv = mix(P[i0], P[i1], fr), lv = mix(Lm[i0], Lm[i1], fr), dv = mix(D[i0], D[i1], fr);
        const k = lv * (1 - 0.7 * dv) * (0.5 + 0.5 / (1 + (fd > 0 ? fd : 0) / 30));
        r = mix(ca[0], cb[0], pv) * 255 * k;
        g = mix(ca[1], cb[1], pv) * 255 * k;
        b = mix(ca[2], cb[2], pv) * 255 * k;
        // just behind the front the metal is still glowing
        const hh = 0.42 * exp(-(fd > 0 ? fd : 0) / 3);
        r = mix(r, hot[0], hh); g = mix(g, hot[1], hh); b = mix(b, hot[2], hh);
      } else r = g = b = 0;
      if (sol < 1) {
        // the liquid: dim and warm, brighter toward the front, with a slow shimmer
        const dd = fd < 0 ? -fd : 0;
        const shim = 1 + 0.12 * sin(0.37 * x + 0.7 * t + 0.21 * y) * sin(0.29 * y - 0.9 * t + 0.4 * x);
        const lb = (0.1 + 0.62 * exp(-dd / 4.5)) * shim;
        r = mix(cl2[0] * 255 * lb, r, sol);
        g = mix(cl2[1] * 255 * lb, g, sol);
        b = mix(cl2[2] * 255 * lb, b, sol);
      }
      // the front itself: a hot line a little over 2 LEDs thick with a halo that reaches further into the liquid
      const ad = fd < 0 ? -fd : fd;
      if (ad < 7) {
        const core = exp(-(fd * fd) / 1.7);
        const halo = 0.3 * exp(-ad / (fd < 0 ? 3 : 1.8));
        const e = core * 0.95 + halo;
        r = mix(r, hot[0], min(e, 1)); g = mix(g, hot[1], min(e, 1)); b = mix(b, hot[2], min(e, 1));
      }
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
