// ===== Patternflow pattern =====
// Title:   Sector Magnet
// Family:  massspectrometry
// Idea:    Ions leave a slit at the bottom left and a magnetic field bends each mass onto its own half circle, so a sample that keeps changing draws nested glowing arcs that swell at the apex, come back to a point and light a plate along the left edge, higher up the heavier they are, while bunches of ions run round each arc from the slit to the plate.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the 180 degree magnetic spectrometer, in which ions that leave a slit over a spread of angles come together again after half a turn (Dempster 1918, from memory); the mass spectrograph that records every mass at once as a line on a photographic plate (Aston 1919, from memory); the radius r = sqrt(2 m V / q) / B and the half-turn time pi m / (q B), textbook results; the isotope pairs of chlorine, about 3 to 1, and of bromine, about 1 to 1 (from memory); compounds reaching the source one after another from a gas chromatograph (Gohlke and McLafferty in the 1950s, from memory); a spectrum scaled to its strongest line. Original here: the sample generator and its rule that the light end and the heavy end are never empty, the half turn slowed to seconds with its mass dependence softened, pairs drawn wider apart than an instrument this size would resolve them, far heavier masses kept nearly dark while they run into the wall, a beam whose direction and height follow the mix in the source, the colours and the drawing, pattern round 246
// Round:   246
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Field=0..4, Divergence=-1..1, Energy=0..1
//
// Knob 1: Hue. Turns every mass colour round the wheel. It opens with the lightest masses amber and lime, the middle green and cyan, the heaviest blue and violet, on a ground of very dark blue; each compound sits a little to one side of that scale.
// Knob 2: Field. 0 to 4, opening at 2: the strength of the magnet, which decides the part of the mass range that lands on the plate. Every radius goes as one over the field. At 2 the main masses turn on 8 to 53 LED and fill the panel. At 0 the field is 2.8 times weaker, the heavy masses run off the right edge and never reach the plate. At 4 it is 2.3 times stronger, the main masses sit in the lower left, 23 LED at the most, and the far heavier masses some compounds carry, which hit the wall at 2, come round as fainter arcs of 31 to 49 LED.
// Knob 3: Divergence. -1 to 1, opening at 0: the spread of angles at the slit. At -1 each mass is a pencil beam under 3 LED wide. At 0 a 50 LED arc is about 6 LED wide at its apex. At 1 it is a crescent about 17 LED wide that overlaps its neighbours and still comes back to a short line on the plate.
// Knob 4: Energy. 0 to 1, opening at 0.06: the spread of energies in the source, which is a spread of radii that the half turn does not bring back together. At 0 the lines on the plate are sharp. At 1 each ribbon widens all the way round, a 50 LED arc lands as a band about 19 LED wide and the bands run into each other.

const W = 64, H = 128;
const { floor, ceil, min, max, sqrt, exp, sin, cos, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const XP = 4.3;              // the face of the plate, and the plane of the slit
const SX = XP + 0.5;         // the slit
const SY = 118.5;            // its mean height
const RMIN = 8, RMAX = 53, XR0 = 72, XRS = 40;   // radii at the opening field, LED
const S0 = 0.95, S02 = S0 * S0; // the least half width of a ribbon (sigma): 2.2 LED across at half height
const NT = 32;               // steps of the table that holds a line's brightness along its half turn
const TMAX = 8;            // seconds the heaviest mass takes for the half turn at the opening field
const TAUP = 4.5;            // afterglow of the plate, seconds
const MAXL = 192;            // lines alive at once, at the most
const LUM = 0.42, CHR = 0.62; // a colour is LUM + CHR cos(hue - channel): the three channels always add to the same
const DEPTH = 0.75;          // how deep a compound's own flow swings
const GAIN = 1.9;            // exposure of the tone curve
const TH0 = (48 / 360) * TAU, THS = (226 / 360) * TAU; // hue of the lightest mass, and the span to the heaviest
const LS = 1023 / 6;
const LUT = new Uint8Array(1024);
for (let i = 0; i < 1024; i++) LUT[i] = floor(255 * (1 - exp((-GAIN * i) / LS)) + 0.5);
const GS = 1024 / 6.5, GL = new Float32Array(1026); // e^-x, x from 0 to 6.5
for (let i = 0; i < 1026; i++) GL[i] = exp(-i / GS);
const KA = NT / 2, KB = (0.273 * 2 * NT) / PI; // twice the arctangent of h, in table steps, is about h (KA + KB (1 - h))
const MASK = new Float32Array(W);
for (let x = 0; x < W; x++) MASK[x] = sstep(XP - 0.75, XP + 0.75, x + 0.5);

// A ribbon s times wider is s^(3/8) dimmer: x is 1 / s^2.
function dimmer(x) {
  const e = sqrt(sqrt(sqrt(sqrt(x))));
  return e * e * e;
}

// The pattern keeps its own random stream, started from Math.random once, so the sample is the same whatever the knobs do to the drawing.
function rnd(st) {
  const a = (st.seed = (st.seed + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A second stream for the masses heavier than the panel holds at the opening field, so that they leave the rest of the sample as it was.
function rnd2(st) {
  const a = (st.seed2 = (st.seed2 + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, seed: 1, seed2: 2, next: 0, ph: [],
    comps: [], nL: 0,
    lr: f(MAXL), lcx: f(MAXL), lcy: f(MAXL), lct: f(MAXL), lst: f(MAXL), lrsa: f(MAXL), lrse: f(MAXL), lq: f(MAXL), ltr: f(MAXL), lreach: f(MAXL), lmax: f(MAXL),
    tab: f(MAXL * (NT + 1)),
    ca: 1, sa: 0, a0: 0, ga: 0, gy: 0, gg: 0.5,
    pA: f(H), pX: f(H), pY: f(H),
    A: f(W * H), X: f(W * H), Y: f(W * H),
  };
  params.st = st;
  return st;
}

// ---- the sample -------------------------------------------------------------
// A compound is a peak in time with a sharp front and a longer tail, and a handful of masses with their abundances.
function newCompound(st, tp) {
  const R = () => rnd(st);
  const D = 5 + 15 * pow(R(), 1.5);
  const wr = D * (0.05 + 0.05 * R()), wf = (D - 3.2 * wr) / 3.2;
  const r0 = [], ab = [];
  // the whole molecule is the heaviest line, the fragments lie below it
  let rM = RMAX - 27 * R() * R();
  // the heavy end is never left empty: if nothing heavy will be strong when this one peaks, this one is heavy
  let heavy = false, light = false;
  for (const c of st.comps) {
    if (c.t0 + c.wf < tp + 2.5) continue;
    if (c.r0[0] > 43) heavy = true;
    if (c.lt) light = true;
  }
  if (!heavy) rM = RMAX - 9 * R();
  const pair = R() < 0.4 ? (R() < 0.5 ? 1 / 3 : 1) : 0;
  const n = 3 + floor(4.999 * pow(R(), 1.7));
  const far = (r) => {
    for (let i = 0; i < r0.length; i++) if (r > r0[i] - 4.2 && r < r0[i] + 4.2) return false;
    return true;
  };
  const add = (r, a, pr) => {
    r0.push(r);
    ab.push(a);
    if (pr) {
      // the heavier isotope: a second line a little further out, a third as strong or as strong
      const dr = min(8, (3.7 * rM) / r);
      if (far(r + dr)) (r0.push(r + dr), ab.push(a * pair));
    }
  };
  if (pair) rM -= 3.7;
  const base = R() < 0.35 ? 0 : 1 + floor(R() * (n - 1));
  add(rM, base === 0 ? 1 : heavy ? 0.2 + 0.6 * R() : 0.55 + 0.4 * R(), pair > 0);
  let lt = false;
  for (let i = 1; i < n && r0.length < 8; i++) {
    for (let tries = 0; tries < 20; tries++) {
      // and the light end the same way: the first fragment is a light and strong one if no other compound has one
      const low = i === 1 && !light, r = low ? RMIN + 10 * R() : RMIN + (rM - 4.5 - RMIN) * R();
      if (!far(r) || (pair && !far(r + min(8, (3.7 * rM) / r)))) continue;
      const a = i === base ? 1 : low ? 0.55 + 0.4 * R() : 0.06 + 0.8 * R() * R() * R();
      if (r < RMIN + 11 && a > 0.5) lt = true;
      add(r, a, pair > 0 && R() < 0.45);
      break;
    }
  }
  // Six compounds in ten also carry one to three masses far heavier than the rest, fainter lines with radii of 72 to 112 LED at
  // the opening field. There they run into the right-hand wall; they only come round to the plate when the field is turned up.
  const nm = r0.length, xr = [];
  if (rnd2(st) < 0.6) {
    const m = 1 + floor(2.999 * rnd2(st) * rnd2(st));
    for (let i = 0; i < m; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const r = XR0 + XRS * rnd2(st);
        let ok = true;
        for (const q of xr) if (r > q - 9 && r < q + 9) ok = false;
        if (!ok) continue;
        xr.push(r);
        r0.push(r);
        ab.push(0.18 + 0.4 * rnd2(st));
        break;
      }
    }
  }
  const hu = [], ue = [];
  for (let i = 0; i < r0.length; i++) {
    hu.push(cl((r0[i] - RMIN) / (RMAX + 2 - RMIN), 0, 1));
    ue.push(i < nm ? -1 : (r0[i] - XR0) / XRS);
  }
  return { t0: tp, wr, wf, br: 0.65 + 0.7 * R(), r0, ab, hu, ue, lt, cs: R(), da: -0.1 + 0.32 * R(), dy: 14 * R() - 7, dh: 0.8 * R() - 0.4, f1: TAU / (1.3 + 0.9 * R()), f2: TAU / (4 + 3 * R()), p1: TAU * R(), p2: TAU * R() };
}
// How much of a compound left the slit at the time tp: its peak, and its own unsteady flow.
function env(c, tp) {
  const s = (tp - c.t0) / (tp < c.t0 ? c.wr : c.wf);
  return s * s > 21 ? 0 : exp(-0.5 * s * s);
}
function flow(c, tp, d) {
  return 1 + d * sin(c.f1 * tp + c.p1 + 1.3 * sin(c.f2 * tp + c.p2));
}
// The source flickers, the same for every mass: what leaves the slit together travels round each arc at that mass's speed.
function src(st, tp) {
  const p = st.ph;
  return 1 + 0.09 * sin(tp * 4.586 + p[7]) + 0.06 * sin(tp * 2.607 + p[9]);
}

// ---- one step: who is in the source, where each arc lies, what reaches the plate ----
function step(st, dt, full) {
  const k = st.k, p = st.ph;
  st.t += dt;
  const t = st.t;
  // peaks follow each other 1.3 to 3.1 s apart; a compound is made 7 s ahead of its peak, before its front arrives
  while (t >= st.next - 7) {
    st.comps.push(newCompound(st, st.next));
    st.next += 0.9 + 1.2 * rnd(st);
  }
  for (let i = st.comps.length - 1; i >= 0; i--) {
    const c = st.comps[i];
    if (t - 13.2 - c.t0 > 3.3 * c.wf) st.comps.splice(i, 1);
  }
  // each compound in the source pushes the beam its own way: the direction it leaves in, the height it leaves at, the gas it
  // adds to the vacuum. The beam follows the mix of what is there, a few seconds behind.
  let wt = 0.15, ta = 0, ty = 0, tg = 0.075;
  for (const c of st.comps) {
    const w = c.br * env(c, t);
    wt += w; ta += w * c.da; ty += w * c.dy; tg += w * c.cs;
  }
  const lag = 1 - exp(-dt / 2.5);
  st.ga += (ta / wt - st.ga) * lag;
  st.gy += (ty / wt - st.gy) * lag;
  st.gg += (tg / wt - st.gg) * lag;
  // and the magnet breathes
  const B = exp((k[1] > 2 ? 0.416 : 0.515) * (k[1] - 2)) * (1 + 0.032 * sin((TAU * t) / 41.3 + p[0]) + 0.026 * sin((TAU * t) / 97.1 + p[1]) + 0.014 * sin((TAU * t) / 17.9 + p[2]));
  const a0 = max(-0.05, 0.03 + st.ga + 0.03 * sin((TAU * t) / 53.7 + p[3]));
  const sy = min(124.5, SY + st.gy + 1.5 * sin((TAU * t) / 71.9 + p[5]));
  const gas = 0.0006 + 0.0054 * st.gg;
  // slow turns of the palette: the light end, the heavy end and the middle
  const h1 = 0.15 + 0.15 * sin((TAU * t) / 67.3 + p[11]), h2 = 0.15 * sin((TAU * t) / 83.9 + p[12]), h3 = 0.15 * sin((TAU * t) / 59.1 + p[13]);
  const sa = 0.05 * exp((k[2] > 0 ? 1.03 : 1.4) * k[2]);
  const se = 0.005 * exp(2.77 * k[3]);
  const ca = cos(a0), sA = sin(a0);
  st.ca = ca;
  st.a0 = a0;
  st.sa = sA;
  // where each line lies, and how much of it passes the right-hand wall and comes back
  let n = 0, S = 0;
  for (const c of st.comps) {
    const e = c.br * env(c, t);
    for (let i = 0; i < c.r0.length && n < MAXL; i++, n++) {
      const r = c.r0[i] / B, cx = SX - r * sA, rsa = r * sa, rse = r * se;
      const tr = 1 / (1 + exp((-1.7 * (63.3 - cx - r)) / sqrt(S02 + rsa * rsa + rse * rse)));
      st.lr[n] = r; st.lcx[n] = cx; st.lcy[n] = sy - r * ca; st.lrsa[n] = rsa; st.lrse[n] = rse; st.lq[n] = r * sa * sa; st.ltr[n] = tr;
      // the exposure follows the strongest lines that stay on the panel, the way a spectrum is scaled to its base peak
      const v = e * c.ab[i] * (0.1 + 0.9 * tr);
      S += v * v * v;
    }
  }
  st.nL = n;
  const g = (1.25 / max(0.25, pow(S, 1 / 3))) * pow(sa / 0.05, 0.25);
  const fade = exp(-dt / TAUP), { pA, pX, pY } = st;
  for (let y = 0; y < H; y++) (pA[y] *= fade), (pX[y] *= fade), (pY[y] *= fade);
  n = 0;
  for (const c of st.comps) {
    for (let i = 0; i < c.r0.length && n < MAXL; i++, n++) {
      const r = st.lr[n], cx = st.lcx[n], cy = st.lcy[n], rsa = st.lrsa[n], rse = st.lrse[n], q = st.lq[n], tr = st.ltr[n];
      // the far heavier masses are held to 7 s for the half turn and to shallower bunches, so they read as whole arcs
      const xh = c.ue[i] >= 0;
      const T = min(xh ? 7 : 13, (TMAX * pow(c.r0[i] / RMAX, 1.25)) / sqrt(B)), d = (xh ? 0.4 : DEPTH) * sstep(0.3, 1.4, T);
      // nothing of this compound is on its way round yet, or any more
      if (t < c.t0 - 4.6 * c.wr || t - T > c.t0 + 4.6 * c.wf) {
        st.lmax[n] = 0;
        continue;
      }
      // and one that runs into the wall is drawn at a twentieth of its strength, so it does not crowd the opening picture
      const a = g * c.br * c.ab[i] * (xh ? 0.05 + 0.95 * tr : 1), o = n * (NT + 1), loss = ((xh ? 0.5 : 1) * gas * r * PI) / NT;
      let mx = 0;
      for (let j = full ? 0 : NT; j <= NT; j++) {
        const tp = t - (T * j) / NT;
        const v = a * env(c, tp) * flow(c, tp, d) * src(st, tp) * exp(-loss * j);
        st.tab[o + j] = v;
        if (v > mx) mx = v;
      }
      st.lmax[n] = mx;
      if (mx < 0.012) continue;
      // the hue follows the mass, each compound a little to one side of it; the light end only turns towards green
      const u = c.hu[i], dh = xh ? 0.5 * c.dh + 0.3 * c.ue[i] : c.dh < 0 ? -c.dh * (1 - 2 * sstep(0.08, 0.4, u)) : c.dh;
      const th = TH0 + THS * pow(u, 0.85) + dh + h1 * (1 - u) * (1 - u) + h2 * u * u + h3 * 4 * u * (1 - u);
      const ct = (st.lct[n] = cos(th)), sn = (st.lst[n] = sin(th));
      st.lreach[n] = 3.1 * sqrt(S02 + rsa * rsa + 4 * rse * rse) + q + 1;
      // the plate: a line where the arc lands, a little short of two radii when the beam is wide
      const hx = XP - cx, yl = cy - sqrt(max(0, r * r - hx * hx)) + q;
      const sl2 = S02 + 4 * rse * rse + 2 * q * q, sl = sqrt(sl2);
      const dep = (st.tab[o + NT] * tr * dimmer(S02 / sl2) * dt) / TAUP;
      if (dep > 0 && yl > -3 * sl) {
        const y0 = max(0, floor(yl - 3 * sl)), y1 = min(H - 1, ceil(yl + 3 * sl));
        for (let y = y0; y <= y1; y++) {
          const e = y + 0.5 - yl, w = dep * exp((-e * e) / (2 * sl2));
          pA[y] += w;
          pX[y] += w * ct;
          pY[y] += w * sn;
        }
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    st.seed = floor(Math.random() * 4294967296) | 0;
    st.seed2 = (st.seed ^ 0x5bd1e995) | 0;
    for (let i = 0; i < 14; i++) st.ph.push(TAU * rnd(st));
    // run the sample for a while before the first frame, and the plate for the last part of it
    st.t = -46;
    st.next = -46;
    while (st.t < -0.05) step(st, 0.1, false);
    step(st, -st.t, true);
  }
  step(st, cl(dt || 0, 0, 0.1), true);
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { A, X, Y, tab } = st, ca = st.ca, sA = st.sa, tilt = (st.a0 * NT) / PI;
  // the ground: a very dark tint over the field
  const GA = 0.03, GX = 0.034 * cos(4.36), GY = 0.034 * sin(4.36);
  for (let o = 0; o < W * H; o++) (A[o] = GA), (X[o] = GX), (Y[o] = GY);
  // the ribbons
  for (let n = 0; n < st.nL; n++) {
    if (st.lmax[n] < 0.012) continue;
    const r = st.lr[n], cx = st.lcx[n], cy = st.lcy[n], rsa = st.lrsa[n], rse = st.lrse[n], q = st.lq[n], tr = st.ltr[n];
    const ct = st.lct[n], sn = st.lst[n], reach = st.lreach[n], ot = n * (NT + 1);
    const Ro = r + reach, Ri = max(0, r - reach), Ro2 = Ro * Ro, Ri2 = Ri * Ri;
    const y0 = max(0, floor(cy - Ro)), y1 = min(H - 1, ceil(cy + Ro));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, h2 = Ro2 - dy * dy;
      if (h2 <= 0) continue;
      const xa = max(4, Ri2 > dy * dy ? floor(cx + sqrt(Ri2 - dy * dy) - 0.5) : 4), xb = min(W - 1, ceil(cx + sqrt(h2) - 0.5));
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - cx, rho = sqrt(dx * dx + dy * dy), inv = 1 / (rho + 1e-6);
        const s1 = dx * inv, c1 = dy * inv;
        // sine and cosine of the angle travelled since the slit
        let sf = s1 * ca - c1 * sA;
        const cf = c1 * ca + s1 * sA, oc = 1 - cf;
        if (sf < 0) sf = 0;
        const e1 = rsa * sf, e2 = rse * oc, qq = q * cf * oc;
        const vr = S02 + e1 * e1 + e2 * e2 + 0.5 * qq * qq, u = rho - r - 0.5 * qq, ex = (u * u) / (2 * vr);
        if (ex > 6.5) continue;
        // how far round the pixel is, in table steps, from the half angle
        let fi;
        if (dx <= 0) fi = dy > 0 ? 0 : NT;
        else if (dy >= 0) {
          const h = dx / (rho + dy);
          fi = h * (KA + KB * (1 - h));
        } else {
          const h = dx / (rho - dy);
          fi = NT - h * (KA + KB * (1 - h));
        }
        fi -= tilt;
        fi = fi < 0 ? 0 : fi > NT - 0.001 ? NT - 0.001 : fi;
        const j = fi | 0, m0 = tab[ot + j];
        let a = (m0 + (tab[ot + j + 1] - m0) * (fi - j)) * GL[(ex * GS) | 0] * dimmer(S02 / vr) * MASK[x];
        if (tr < 0.999 && c1 < 0.15) a *= tr + (1 - tr) * sstep(-0.15, 0.15, c1);
        const o = y * W + x;
        A[o] += a;
        X[o] += a * ct;
        Y[o] += a * sn;
      }
    }
  }
  // the plate
  const { pA, pX, pY } = st;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < 5; x++) {
      const o = y * W + x, m = 1 - MASK[x], pm = MASK[x];
      A[o] = A[o] * pm + m * (0.2 + 1.6 * pA[y]);
      X[o] = X[o] * pm + m * (-0.02 + 1.6 * pX[y]);
      Y[o] = Y[o] * pm + m * (-0.03 + 1.6 * pY[y]);
    }
  }
  // tone: the hue knob turns every colour about the grey axis, then each channel is bent by 1 - e^-x
  const th = TAU * st.k[0];
  const c0 = CHR * cos(th), s0 = CHR * sin(th), c1 = CHR * cos(th - TAU / 3), s1 = CHR * sin(th - TAU / 3), c2 = CHR * cos(th + TAU / 3), s2 = CHR * sin(th + TAU / 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x, a = LUM * A[o], xx = X[o], yy = Y[o];
      let r = (a + xx * c0 - yy * s0) * LS, g = (a + xx * c1 - yy * s1) * LS, b = (a + xx * c2 - yy * s2) * LS;
      r = r < 0 ? 0 : r > 1023 ? 1023 : r;
      g = g < 0 ? 0 : g > 1023 ? 1023 : g;
      b = b < 0 ? 0 : b > 1023 ? 1023 : b;
      display.setPixel(x, y, LUT[r | 0], LUT[g | 0], LUT[b | 0]);
    }
  }
}
