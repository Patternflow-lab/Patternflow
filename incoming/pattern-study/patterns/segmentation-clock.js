// ===== Patternflow pattern =====
// Title:   Segmentation Clock
// Family:  embryo
// Idea:    A zebrafish tail bud sits at the bottom of the panel and every cell of the tissue above it carries a genetic oscillator that slows as the cell is pushed away from the bud, so arcs of green expression climb the tissue, slow down, and freeze into a rising column of chevron stripes with magenta boundaries, while Delta-Notch coupling keeps neighbours in step and noise, a wandering period and a wandering growth speed leave the odd fused or dropped segment.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: clock and wavefront model (Jonathan Cooke and Christopher Zeeman, 1976), the chick segmentation clock c-hairy1 (Isabel Palmeirim and others, 1997), Delta-Notch coupling of the oscillators (Yun-Jin Jiang and others, 2000; Julian Lewis, 2003), salt-and-pepper tissue when coupling is weak (Ertugrul Ozbudak and Julian Lewis, 2008), live her1 and her7 reporters in the zebrafish presomitic mesoderm; pattern round 205
// Round:   205
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=1.2..3.2, Period=7..13, Decoupling=0..1
//
// Knob 1: Hue. Turns the expression colour round the wheel from the green it opens on; the boundary stain and the notochord stay opposite to it.
// Knob 2: Growth. How fast the tail bud pushes the tissue up, from 1.2 LEDs a second (the 64 LED panel height takes about 100 s to cross) to 3.2 LEDs a second; a segment is growth times period long, so it is 8 LEDs long at the slow end and 14 LEDs at the start.
// Knob 3: Period. The clock period at the tail bud, from 7 s at the start to 13 s: one stripe leaves the bud every period, so slower means fewer, fatter arcs and longer segments (14 LEDs at 7 s and 2 LEDs a second, 26 LEDs at 13 s).
// Knob 4: Decoupling. How much Delta-Notch signalling is blocked: at 0.06 the cells keep step and the arcs are clean and smooth, at 0.5 the stripes break into patches and forks, at 1 neighbours lose each other and the tissue goes to salt and pepper.

const W = 64;
const H = 128;
const { floor, sin, cos, exp, sqrt, abs, log, pow, PI, min, max } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rise = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// Cells are 1.5 LEDs apart, 30 across, so the tissue is 45 LEDs wide. Rows are
// born at the tail bud and carried up the panel; a row's place on the panel is
// the growth it has had since birth, so the front stays where it is.
const CS = 1.5;
const NX = 30;
const NR = 92;
const XC = 32;
const YB = 125;
const HW = 22;
const DF0 = 58;
const MID = (NX - 1) / 2;
const U = new Float32Array(NX);
for (let c = 0; c < NX; c++) U[c] = (c - MID) / MID;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const n = NR * NX;
  params.s = {
    first: true, t: 0, k: [0, 2, 7, 0.06],
    th: new Float32Array(n), ep: new Float32Array(n), fj: new Float32Array(n),
    ps: new Float32Array(n), cs: new Float32Array(n), sn: new Float32Array(n), cx: new Float32Array(n),
    xi: new Float32Array(n), om: new Float32Array(n), ka: new Float32Array(n), dth: new Float32Array(n),
    z: 0, rNew: -1, thb: Math.random() * TAU,
    vk: 2, tk: 7, dc: 0.06,
    aT: 0, aV: 0, lean: 0, slip: 0, slipLeft: 0, slipRate: 0,
    ph: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
    wob: new Float32Array(NX), P: new Float32Array(NX),
    lum: new Float32Array(W * H), mag: new Float32Array(W * H), tmp: new Float32Array(W * H),
    cG: [0, 1, 0], cM: [1, 0, 1],
  };
}

function newRow(S, dc) {
  const r = ++S.rNew;
  const row = rowIndex(r);
  const sig = 0.08 + 1.8 * pow(dc, 1.5);
  for (let c = 0; c < NX; c++) {
    const i = row + c;
    // The bud hands each new row the bud's phase, a little behind at the sides.
    S.th[i] = S.thb - 1.8 * pow(abs(U[c] - S.lean), 1.2) + sig * gauss();
    S.ep[i] = gauss();
    S.xi[i] = 0;
    S.fj[i] = 1.4 * gauss();
  }
}

function rowIndex(r) {
  return (((r % NR) + NR) % NR) * NX;
}

function advance(S, dt) {
  const k = S.k;
  const a = 1 - exp(-dt / 1.2);
  S.vk += (cl(k[1], 1.2, 3.2) - S.vk) * a;
  S.tk += (cl(k[2], 7, 13) - S.tk) * a;
  S.dc += (cl(k[3], 0, 1) - S.dc) * a;
  const dc = S.dc;
  S.t += dt;
  const t = S.t;

  // The period wanders about a minute-long mean, the growth speed wanders
  // slower and further, and the lean of the chevrons drifts.
  S.aT += (-S.aT / 14) * dt + 0.11 * sqrt((2 * dt) / 14) * gauss();
  S.aV += (-S.aV / 45) * dt + 0.2 * sqrt((2 * dt) / 45) * gauss();
  S.lean += (-S.lean / 40) * dt + 0.12 * sqrt((2 * dt) / 40) * gauss();
  S.aT = cl(S.aT, -0.35, 0.35);
  S.aV = cl(S.aV, -0.45, 0.45);
  S.lean = cl(S.lean, -0.3, 0.3);
  const T = S.tk * exp(S.aT);
  const v = S.vk * exp(S.aV);
  const w0 = TAU / T;

  // Now and then the bud skips a beat or runs one early: the next segment comes
  // out long or short.
  if (S.slipLeft > 0) {
    S.slipLeft -= dt;
    if (S.slipLeft <= 0) S.slipRate = 0;
  } else if (Math.random() < dt / 55) {
    const mag = (0.4 + 0.45 * Math.random()) * TAU * (Math.random() < 0.55 ? -1 : 1);
    S.slipLeft = 4;
    S.slipRate = mag / 4;
  }
  S.thb += (w0 + S.slipRate) * dt;
  S.thb -= TAU * floor(S.thb / TAU);

  // Coupling and the spread of cell clocks.
  const Kc = 1.0 * pow(0.04, dc);
  const sigE = 0.03 + 0.12 * dc;
  // Noise on each cell's clock rate, correlated for about 2.5 s so the speckle
  // drifts instead of flickering.
  const xa = exp(-dt / 2.5);
  const xs = (0.01 + 0.2 * pow(dc, 1.4)) * sqrt(1 - xa * xa);

  // The determination front wobbles from side to side.
  for (let c = 0; c < NX; c++) {
    const u = U[c];
    S.wob[c] = 0.55 * sin(2.3 * u + 0.21 * t + S.ph[0]) + 0.45 * sin(4.1 * u - 0.13 * t + S.ph[1]) + 0.3 * sin(7.3 * u + 0.29 * t + S.ph[2]);
    S.P[c] = 1 - 0.18 * pow(abs(u - S.lean), 1.2);
  }

  S.z += v * dt;
  while (S.z >= (S.rNew + 1) * CS) newRow(S, dc);
  const rMin = max(0, S.rNew - NR + 2);
  const rNew = S.rNew;
  const { th, ep, fj, om, ka, dth, wob, P, xi } = S;

  // Pass one: each cell's own frequency and how much of the coupling it feels.
  for (let r = rMin; r <= rNew; r++) {
    const row = rowIndex(r);
    const d = S.z - r * CS;
    for (let c = 0; c < NX; c++) {
      const i = row + c;
      const df = DF0 * (1 + 0.09 * wob[c]) + fj[i];
      const s = d / df;
      dth[i] = 0;
      if (s >= 1) {
        ka[i] = -1;
        continue;
      }
      const g = pow(1 - s, 1.8);
      om[i] = w0 * P[c] * g * (1 + sigE * ep[i]);
      ka[i] = 1 - rise(0.8, 1, s);
    }
  }
  // Pass two: the coupling, along the row and between rows.
  for (let r = rMin; r <= rNew; r++) {
    const row = rowIndex(r);
    const up = r < rNew ? rowIndex(r + 1) : -1;
    for (let c = 0; c < NX; c++) {
      const i = row + c;
      const ki = ka[i];
      if (c < NX - 1) {
        const j = i + 1;
        const kj = ka[j];
        if (ki >= 0 || kj >= 0) {
          const w = Kc * 0.5 * (max(ki, 0) + max(kj, 0));
          const f = w * sin(th[j] - th[i]);
          if (ki >= 0) dth[i] += f;
          if (kj >= 0) dth[j] -= f;
        }
      }
      if (up >= 0) {
        // Row r + 1 is the younger one: it was born later, so it sits lower on the panel.
        const j = up + c;
        const kj = ka[j];
        if (ki >= 0 || kj >= 0) {
          const w = Kc * 0.5 * (max(ki, 0) + max(kj, 0));
          const f = w * sin(th[j] - th[i]);
          if (ki >= 0) dth[i] += f;
          if (kj >= 0) dth[j] -= f;
        }
      }
    }
  }
  // Defects: a patch of cells gets knocked out of phase.
  if (Math.random() < (dt * (1 + 4 * dc)) / 26) {
    const u0 = (Math.random() * 2 - 1) * 0.8;
    const d0 = 8 + Math.random() * 0.75 * DF0;
    const rad = 4 + 3 * Math.random();
    const amp = (0.5 + 1.2 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    S.kick = { u0, d0, rad, amp };
  }
  const kick = S.kick;
  S.kick = null;
  for (let r = rMin; r <= rNew; r++) {
    const row = rowIndex(r);
    const d = S.z - r * CS;
    for (let c = 0; c < NX; c++) {
      const i = row + c;
      if (ka[i] < 0) continue;
      xi[i] = xi[i] * xa + xs * gauss();
      th[i] += (om[i] + dth[i] + xi[i] * ka[i]) * dt;
      if (kick) {
        const dx = (U[c] - kick.u0) * MID * CS;
        const dy = d - kick.d0;
        th[i] += kick.amp * exp(-(dx * dx + dy * dy) / (2 * kick.rad * kick.rad));
      }
    }
  }
  return { v, T };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 7, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.vk = cl(S.k[1], 1.2, 3.2);
    S.tk = cl(S.k[2], 7, 13);
    S.dc = cl(S.k[3], 0, 1);
    S.aT = 0.1 * gauss();
    S.aV = 0.15 * gauss();
    S.lean = 0.1 * gauss();
    const span = min(170, (YB + 10) / S.vk + 40);
    for (let t = 0; t < span; t += 1 / 15) advance(S, 1 / 15);
    S.first = false;
  }
  const r = advance(S, dt);
  S.vNow = r.v;
  S.TNow = r.T;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { th, lum, mag, tmp, cG, cM } = S;
  const rNew = S.rNew;
  const rMin = max(0, rNew - NR + 2);
  const k0 = S.k[0];
  hsv(0.37 + k0, 0.95, 1, cG);
  hsv(0.37 + k0 + 0.47, 0.9, 1, cM);

  // Expression is a sharpened cosine of the phase and the boundary stain sits
  // where expression is lowest and grows in once the cell has frozen. Both are
  // worked out on the phase interpolated to each LED, so a thin line follows
  // its contour instead of blinking between cells.
  const Lnom = cl(S.vNow * S.TNow, 8, 50);
  const bw2 = (6.4 / Lnom) * (6.4 / Lnom);
  // The phase the pixels read is the cells' phasors averaged over a small
  // neighbourhood. In step it changes nothing; out of step it turns a speck
  // of one cell into a soft patch about three LEDs across.
  const wb = 0.1 + 0.15 * S.dc;
  const { ps, cs, sn, cx } = S;
  for (let r = rMin; r <= rNew; r++) {
    const row = rowIndex(r);
    for (let c = 0; c < NX; c++) {
      cs[row + c] = cos(th[row + c]);
      sn[row + c] = sin(th[row + c]);
    }
  }
  for (let r = rMin; r <= rNew; r++) {
    const row = rowIndex(r);
    for (let c = 0; c < NX; c++) {
      const c0 = c > 0 ? c - 1 : c, c1 = c < NX - 1 ? c + 1 : c;
      // along the row first, kept in cx (cos) and ps (sin) for the vertical pass
      cx[row + c] = (1 - 2 * wb) * cs[row + c] + wb * (cs[row + c0] + cs[row + c1]);
      ps[row + c] = (1 - 2 * wb) * sn[row + c] + wb * (sn[row + c0] + sn[row + c1]);
    }
  }
  for (let r = rMin; r <= rNew; r++) {
    const row = rowIndex(r);
    const lo = r > rMin ? rowIndex(r - 1) : row, hi = r < rNew ? rowIndex(r + 1) : row;
    for (let c = 0; c < NX; c++) {
      const a = (1 - 2 * wb) * cx[row + c] + wb * (cx[lo + c] + cx[hi + c]);
      const b = (1 - 2 * wb) * ps[row + c] + wb * (ps[lo + c] + ps[hi + c]);
      cs[row + c] = Math.atan2(b, a);
    }
  }
  const phi = cs;

  lum.fill(0);
  mag.fill(0);
  for (let y = 0; y < H; y++) {
    const d = YB - (y + 0.5);
    const ds = d + 3;
    if (ds <= 0) continue;
    const s2 = cl(ds / 34, 0, 1);
    const hw = HW * (0.14 + 0.86 * sqrt(1 - (1 - s2) * (1 - s2)));
    let rf = (S.z - d) / CS;
    if (rf > rNew - 1e-4) rf = rNew - 1e-4;
    if (rf < rMin) continue;
    const r0 = floor(rf), ra = rf - r0;
    const amp = (0.78 + 0.22 * rise(0, 34, d)) * (1 - 0.42 * rise(DF0, DF0 + 60, d));
    const bud = 0.34 * exp(-(d * d) / 150);
    const bamp = rise(0.7, 1.08, d / DF0) * (1 - 0.35 * rise(DF0, DF0 + 60, d));
    const i0 = rowIndex(r0), i1 = rowIndex(r0 + 1);
    const xa = max(0, floor(XC - hw - 3)), xb = min(W - 1, floor(XC + hw + 3));
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - XC;
      const m = rise(-3, 6, hw - abs(dx));
      if (m < 0.01) continue;
      let cf = dx / CS + MID;
      cf = cl(cf, 0, NX - 1.0001);
      const c0 = floor(cf), ca = cf - c0;
      const a00 = (1 - ra) * (1 - ca), a01 = (1 - ra) * ca, a10 = ra * (1 - ca), a11 = ra * ca;
      const j00 = i0 + c0, j10 = i1 + c0;
      const t00 = phi[j00];
      let dd = phi[j00 + 1] - t00;
      const t01 = dd - TAU * Math.round(dd / TAU);
      dd = phi[j10] - t00;
      const t10 = dd - TAU * Math.round(dd / TAU);
      dd = phi[j10 + 1] - t00;
      const t11 = dd - TAU * Math.round(dd / TAU);
      const e0 = 0.5 + 0.5 * cos(t00 + a01 * t01 + a10 * t10 + a11 * t11);
      const E = pow(e0, 5.5) * amp + bud * (0.45 + 0.55 * e0);
      const B = exp((-4 * e0) / bw2) * bamp;
      const p = y * W + x;
      lum[p] = m * (0.1 + 0.9 * E * (0.55 + 0.45 * m));
      // The notochord: a faint stain down the axis, fading with height.
      const noto = exp(-(dx * dx) / 1.6) * 0.3 * (1 - 0.5 * (YB - y) / YB);
      mag[p] = m * (0.85 * B) + noto * (0.4 + 0.6 * m);
    }
  }

  // Bloom: the bright arcs spill a little light round themselves.
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const p = o + x;
      let a = lum[p] * 0.32;
      if (x > 0) a += lum[p - 1] * 0.22;
      if (x < W - 1) a += lum[p + 1] * 0.22;
      if (x > 1) a += lum[p - 2] * 0.12;
      if (x < W - 2) a += lum[p + 2] * 0.12;
      tmp[p] = a;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let a = tmp[p] * 0.32;
      if (y > 0) a += tmp[p - W] * 0.22;
      if (y < H - 1) a += tmp[p + W] * 0.22;
      if (y > 1) a += tmp[p - 2 * W] * 0.12;
      if (y < H - 2) a += tmp[p + 2 * W] * 0.12;
      const lg = lum[p] * (1 - 0.5 * S.dc * S.dc) + (0.3 + 0.5 * S.dc * S.dc) * a;
      const lm = mag[p];
      if (lg < 0.03 && lm < 0.03) continue;
      const g = cl(pow(max(lg - 0.02, 0), 1.0), 0, 1.4);
      const white = rise(0.8, 1.3, g) * 0.35;
      const gg = min(g, 1);
      const mm = pow(cl(lm, 0, 1.2), 0.9);
      let r = cG[0] * gg + (1 - cG[0]) * white * gg + cM[0] * mm;
      let gC = cG[1] * gg + (1 - cG[1]) * white * gg + cM[1] * mm;
      let b = cG[2] * gg + (1 - cG[2]) * white * gg + cM[2] * mm;
      display.setPixel(x, y, 255 * min(r, 1), 255 * min(gC, 1), 255 * min(b, 1));
    }
  }
}
