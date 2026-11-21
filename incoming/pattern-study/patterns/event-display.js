// ===== Patternflow pattern =====
// Title:   Event Display
// Family:  collider
// Idea:    The live event display of a proton collider detector, the two standard views of one collision stacked on the tall panel: above, the end view looking down the beam, a disc of faint tracker, calorimeter and muon rings with tracks curling out of the centre; below, the side view of the same event, a long rectangle cut by the beam line, where the same tracks run out as nearly straight or gently bent lines and the same calorimeter towers stand as green and orange-red bars on the barrel and the end caps, and every second or so two bunches meet on the beam line, the vertex flashes, two jets and a few lone tracks and a swarm of soft ones grow outward in a quarter of a second, then hold and fade over the next collision.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: collider event displays (UA1 1983, ALEPH, the ATLAS and CMS Fireworks displays), track curvature pT = 0.3 B R, the helix projected into end and side view, jet fragmentation and minimum-bias soft tracks, pattern round 213
// Round:   213
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..8, Field=-1..1, Energy=-1..1
//
// Knob 1: Hue. Turns the whole colour scheme round the colour wheel together: the track ramp, the towers, the muon and the faint detector layers. At 0 the tracks run from violet through blue and cyan to green, yellow and orange as their momentum rises, the calorimeter towers are green with orange-red on top, and a muon is red-orange with yellow hits on the outer ring; 1 comes back to that.
// Knob 2: Rate. How often two bunches meet, 0.3 collisions a second at 0, 0.51 where it opens at 2, 2.5 at 8, on a log scale. More collisions means pile-up: up to 4 vertices along the beam instead of 1, more soft tracks, drawn dimmer and shorter, events that live 0.4 times as long at 8, and at most 40 tracks on the panel instead of 70. At 0 an event lasts 1.35 times as long, and the next one still comes while it fades.
// Knob 3: Field. The magnetic field B, 0.4 T at -1, 3.0 T where it opens at 0, 4.0 T at 1. A track of momentum pT bends on a circle of radius pT / (0.3 B), which at 12 LEDs a metre is 40 pT / B LEDs. At 0.4 T every track is a nearly straight ray; at 4 T a 1 GeV track curls on a circle of 10 LEDs radius and a 0.4 GeV one loops inside the tracker. Events already on the panel bend as the knob turns.
// Knob 4: Energy. How hard the collision is, 0.5 at -1, 1.04 where it opens, 2 at 1. It scales the momentum of the jets (4 to 16 GeV at 1) and of the lone tracks, so the colour of their tracks, and the height of the towers. At 0.5 the jets are a spray of blue and cyan tracks that bend, with stubby towers; at 2 hard tracks run straight and yellow into tall towers, up to 11 LEDs in the barrel.

// One LED is 1/12 m, so a track of pT GeV in B tesla has radius 12 pT / (0.3 B) = 40 pT / B LEDs: B = 3.8 T, pT = 1 GeV gives 10.5 LEDs, which reaches the calorimeter
// (2R = 21 is more than 17); pT 0.4 gives 4.2 LEDs and loops inside the tracker. The helix turns by psi: r = 2R sin(psi / 2) seen end on, z = z0 + R psi cot(theta) along the beam.
// The top 64 by 64 LEDs are the end view (the beam is the point 32, 32), the bottom 64 by 64 the side view (the beam is row 96, z runs across, r up and down, on the side of the
// beam the particle went to in the end view). The calorimeter starts at r = 17 in the barrel and at |z| = 23 in the end caps (the brief said 29, which leaves 2 LEDs for the
// end caps on a panel 64 wide). Tracker r < 13; ECAL r 17 to 21; HCAL r 22 to 27; muon chambers r 29.4 to 31. A track stops at the calorimeter or after one and a half loops;
// a muon goes on to the chambers. A track grows at 125 LEDs a second, holds 1.2 s, fades over 1.5 s. An event is kept as kinematics (pT, eta, phi, charge, vertex) and its
// tracks and towers are rebuilt when Field or Energy moves.
// The file is about 30 KB because it holds two views, the detector layers, a helix tracer, the towers and a halo; none of it repeats.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, pow, abs, min, max, PI, log, sinh, cosh, atan2, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

const CX = 32, CY = 32; // the beam seen end on
const AX = 32, AY = 96; // the beam seen from the side, z = 0
const KM = 40; // LEDs of radius per GeV per tesla
const RCAL = 17, ZCAL = 23; // where the calorimeter starts
const RMU = 31, ZMU = 31.5; // the muon chambers
const NPHI = 48; // towers round the barrel
const TZ = 2.2, TRD = 2.0; // tower size along z in the barrel, along r in the end cap
const VEL = 125; // LEDs a second a track grows at
const TG = 0.25; // seconds from the flash to the first full track
const MAXTRK = 70;
const LOSS = 0.045; // a looper's radius shrinks by this fraction of itself per radian
const BT = 0.5; // seconds the bunches are seen coming in
const STEP = 0.5; // LEDs between the splats that draw a line
const SIG = 0.6; // a line's width, sigma in LEDs (1.4 across at half height)
const NORM = STEP / (SIG * sqrt(TAU));
const GAIN = 1.9;
const HEAD = 3;

// A colour from violet at low momentum to white-hot at high.
const RAMP = [
  [0.0, 0.5, 0.2, 1.0], [0.2, 0.16, 0.4, 1.0], [0.4, 0.05, 0.85, 0.95], [0.55, 0.3, 1.0, 0.45],
  [0.72, 1.0, 0.92, 0.18], [0.87, 1.0, 0.52, 0.08], [1.0, 1.0, 0.86, 0.64],
];
const NR = 40;
const ECAL = [0.2, 1.0, 0.35], HCAL = [1.0, 0.33, 0.1], MUTRK = [1.0, 0.3, 0.12], MUHIT = [1.0, 0.86, 0.1], FLASH = [1.0, 0.93, 0.82], BEAM = [0.7, 0.82, 1.0];

// A colour turned round the wheel on the YIQ chroma plane, brought to a full brightest channel.
function turned(c, hue) {
  const cs = cos(TAU * hue), sn = sin(TAU * hue);
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const I = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2];
  const Q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2];
  const I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
  const r = cl(y + 0.956 * I2 + 0.621 * Q2, 0, 1);
  const g = cl(y - 0.272 * I2 - 0.647 * Q2, 0, 1);
  const b = cl(y - 1.106 * I2 + 1.703 * Q2, 0, 1);
  const top = max(r, g, b, 0.01);
  return [r / top, g / top, b / top];
}
function rampAt(u) {
  let k = 0;
  while (k < RAMP.length - 2 && u > RAMP[k + 1][0]) k++;
  const a = RAMP[k], b = RAMP[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}

// ---------------------------------------------------------------- the detector layers, drawn once

const sdBox = (z, r, Z, R) => {
  const c = 1.5;
  const qz = abs(z) - (Z - c), qr = r - (R - c);
  return hypot(max(qz, 0), max(qr, 0)) + min(max(qz, qr), 0) - c;
};

// 4 layers a pixel: tracker, ECAL, HCAL, muon.
function buildLayers() {
  const L = new Float32Array(W * H * 4);
  const line = (d, w2) => exp(-(d * d) / w2);
  const dashF = (f, duty) => {
    f -= floor(f);
    return sm(0, 0.12, f) * (1 - sm(duty - 0.12, duty, f));
  };
  const arcSep = (phi, m, r) => {
    const f = (phi * m) / TAU;
    const d = abs(f - Math.round(f)) * (TAU / m) * r;
    return exp(-(d * d) / 0.32);
  };
  const linSep = (u, p) => {
    const f = u / p;
    const d = abs(f - Math.round(f)) * p;
    return exp(-(d * d) / 0.32);
  };
  const TR = [3.6, 7.0, 10.2, 13.0], TM = [9, 15, 22, 34], TA = [0.55, 0.65, 0.8, 1.0], TZH = [5.5, 9.5, 14.5, 19.5];
  const band = (dOut, dIn) => (1 - sm(-0.5, 0.5, dOut)) * sm(-0.5, 0.5, dIn);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (y < 64) {
        const dx = x + 0.5 - CX, dy = CY - (y + 0.5);
        const r = hypot(dx, dy), ph = atan2(dy, dx);
        let t = 0;
        for (let k = 0; k < 4; k++) t += 0.07 * TA[k] * line(r - TR[k], 0.5) * (0.35 + 0.65 * dashF((ph * TM[k]) / TAU, 0.7));
        L[o] = t;
        const eb = band(r - 21, 17 - r);
        L[o + 1] = 0.03 * eb + 0.07 * (line(r - 17, 0.5) + line(r - 21, 0.5)) + 0.035 * eb * arcSep(ph, 48, r);
        const hb = band(r - 27, 22 - r);
        L[o + 2] = 0.024 * hb + 0.065 * (line(r - 22, 0.5) + line(r - 27, 0.5)) + 0.032 * hb * arcSep(ph, 24, r);
        const mb = band(r - 31, 29.4 - r);
        L[o + 3] = 0.07 * (line(r - 29.4, 0.5) + line(r - 31, 0.5)) + 0.042 * mb * arcSep(ph, 12, r);
      } else {
        const z = x + 0.5 - AX, r = abs(y + 0.5 - AY);
        const along = (Z, R) => (abs(z) - Z > r - R ? r : abs(z));
        let t = 0;
        for (let k = 0; k < 4; k++) {
          const d = sdBox(z, r, TZH[k], TR[k]);
          t += 0.07 * TA[k] * line(d, 0.5) * (0.35 + 0.65 * dashF(along(TZH[k], TR[k]) / 2.6, 0.7));
        }
        if (abs(z) < 31.8 && r < 0.99) t += 0.05;
        L[o] = t;
        const eo = sdBox(z, r, 26, 21), ei = sdBox(z, r, 23, 17), eb = band(eo, -ei);
        L[o + 1] = 0.03 * eb + 0.07 * (line(eo, 0.5) + line(ei, 0.5)) + 0.035 * eb * linSep(along(24.5, 19), 2.2);
        const ho = sdBox(z, r, 29.7, 27), hi = sdBox(z, r, 27, 22), hb = band(ho, -hi);
        L[o + 2] = 0.024 * hb + 0.065 * (line(ho, 0.5) + line(hi, 0.5)) + 0.032 * hb * linSep(along(28.3, 24.5), 4.4);
        const mo = sdBox(z, r, 31.6, 31), mi = sdBox(z, r, 30.6, 29.4), mb = band(mo, -mi);
        L[o + 3] = 0.07 * (line(mo, 0.5) + line(mi, 0.5)) + 0.042 * mb * linSep(along(31, 30.2), 8);
      }
    }
  }
  return L;
}

// A line is drawn as a row of round splats half a LED apart.
const KER = new Float32Array(37);
for (let j = 0; j < 37; j++) KER[j] = exp(-(j / 10 + 0.05) / (2 * SIG * SIG));

function splat(dyn, x, y, w, cr, cg, cb) {
  const x0 = max(0, floor(x - 1.9)), x1 = min(W - 1, floor(x + 1.9));
  const y0 = max(0, floor(y - 1.9)), y1 = min(H - 1, floor(y + 1.9));
  for (let iy = y0; iy <= y1; iy++) {
    const dy = iy + 0.5 - y, dy2 = dy * dy;
    for (let ix = x0; ix <= x1; ix++) {
      const dx = ix + 0.5 - x, d2 = dx * dx + dy2;
      if (d2 >= 3.6) continue;
      const k = KER[(d2 * 10) | 0] * w;
      const i = (iy * W + ix) * 3;
      dyn[i] += k * cr;
      dyn[i + 1] += k * cg;
      dyn[i + 2] += k * cb;
    }
  }
}
function blob(dyn, x, y, sg, w, c) {
  const rr = ceil(sg * 3);
  const x0 = max(0, floor(x - rr)), x1 = min(W - 1, floor(x + rr));
  const y0 = max(0, floor(y - rr)), y1 = min(H - 1, floor(y + rr));
  const k2 = 1 / (2 * sg * sg);
  for (let iy = y0; iy <= y1; iy++) {
    const dy = iy + 0.5 - y;
    for (let ix = x0; ix <= x1; ix++) {
      const dx = ix + 0.5 - x;
      const k = w * exp(-(dx * dx + dy * dy) * k2);
      const i = (iy * W + ix) * 3;
      dyn[i] += k * c[0];
      dyn[i + 1] += k * c[1];
      dyn[i + 2] += k * c[2];
    }
  }
}
// a soft-edged disc
function disc(dyn, x, y, rad, w, c) {
  const x0 = max(0, floor(x - rad - 1)), x1 = min(W - 1, floor(x + rad + 1));
  const y0 = max(0, floor(y - rad - 1)), y1 = min(H - 1, floor(y + rad + 1));
  for (let iy = y0; iy <= y1; iy++)
    for (let ix = x0; ix <= x1; ix++) {
      const cov = cl(rad + 0.5 - hypot(ix + 0.5 - x, iy + 0.5 - y), 0, 1) * w;
      if (cov <= 0) continue;
      const i = (iy * W + ix) * 3;
      dyn[i] += cov * c[0];
      dyn[i + 1] += cov * c[1];
      dyn[i + 2] += cov * c[2];
    }
}
// a bar from a to b, hw LEDs half-wide, soft at the sides and the ends
function bar(dyn, ax, ay, bx, by, hw, w, c) {
  const dx = bx - ax, dy = by - ay, len = hypot(dx, dy);
  if (len < 0.05) return;
  const ux = dx / len, uy = dy / len;
  const x0 = max(0, floor(min(ax, bx) - hw - 1)), x1 = min(W - 1, floor(max(ax, bx) + hw + 1));
  const y0 = max(0, floor(min(ay, by) - hw - 1)), y1 = min(H - 1, floor(max(ay, by) + hw + 1));
  for (let iy = y0; iy <= y1; iy++)
    for (let ix = x0; ix <= x1; ix++) {
      const px = ix + 0.5 - ax, py = iy + 0.5 - ay;
      const t = px * ux + py * uy;
      const across = cl(hw + 0.5 - abs(px * uy - py * ux), 0, 1);
      if (across <= 0) continue;
      const cov = across * cl(min(t, len - t) + 0.5, 0, 1) * w;
      if (cov <= 0) continue;
      const i = (iy * W + ix) * 3;
      dyn[i] += cov * c[0];
      dyn[i + 1] += cov * c[1];
      dyn[i + 2] += cov * c[2];
    }
}

// ---------------------------------------------------------------- a track

// One charged particle's helix, in steps of about 0.9 LEDs of path. Stops at the surface (Rs, Zs), after maxPsi radians of turning, or after maxS LEDs of path.
function trace(pt, q, phi0, eta, z0, B, maxPsi, Rs, Zs, maxS) {
  const R0 = (KM * pt) / B;
  const sinT = 1 / cosh(eta), cot = sinh(eta);
  let px = 0, py = 0, z = z0, phi = phi0, psi = 0, s3 = 0;
  const X = [0], Y = [0], Z = [z0], S = [0];
  let hit = false;
  for (let it = 0; it < 600; it++) {
    const R = R0 * exp(-LOSS * psi);
    const ds = min(0.9 * sinT, 0.22 * R);
    const dpsi = ds / R;
    const pm = phi + 0.5 * q * dpsi;
    const nx = px + ds * cos(pm), ny = py + ds * sin(pm), nz = z + ds * cot;
    const pr = hypot(px, py), nr = hypot(nx, ny);
    let f = 2;
    if (nr >= Rs) f = (Rs - pr) / (nr - pr);
    if (abs(nz) >= Zs) f = min(f, ((nz > 0 ? Zs : -Zs) - z) / (nz - z));
    if (f <= 1) {
      f = max(f, 0);
      X.push(px + (nx - px) * f);
      Y.push(py + (ny - py) * f);
      Z.push(z + (nz - z) * f);
      S.push(s3 + (ds / sinT) * f);
      px = X[X.length - 1];
      py = Y[Y.length - 1];
      z = Z[Z.length - 1];
      psi += dpsi * f;
      hit = true;
      break;
    }
    px = nx;
    py = ny;
    z = nz;
    phi += q * dpsi;
    psi += dpsi;
    s3 += ds / sinT;
    X.push(px);
    Y.push(py);
    Z.push(z);
    S.push(s3);
    if (psi >= maxPsi || s3 >= maxS) break;
  }
  return { X, Y, Z, S, hit, psi, endcap: hit && abs(z) >= Zs - 0.01, px, py, z };
}

// Resample a polyline to points STEP apart, each carrying its path length. Flat [x, y, s, x, y, s ...].
function resample(xs, ys, ss) {
  const out = [xs[0], ys[0], ss[0]];
  let carry = 0;
  for (let i = 1; i < xs.length; i++) {
    const dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1], len = hypot(dx, dy);
    if (len < 1e-6) continue;
    let d = STEP - carry;
    while (d <= len) {
      const f = d / len;
      out.push(xs[i - 1] + dx * f, ys[i - 1] + dy * f, ss[i - 1] + (ss[i] - ss[i - 1]) * f);
      d += STEP;
    }
    carry = len - (d - STEP);
  }
  const n = xs.length - 1, m = out.length;
  if (hypot(xs[n] - out[m - 3], ys[n] - out[m - 2]) > 0.15) out.push(xs[n], ys[n], ss[n]);
  return Float32Array.from(out);
}

// ---------------------------------------------------------------- an event

const sideOf = (phi) => (sin(phi) >= 0 ? 1 : -1);

function genEvent(S, t0, vz) {
  const rnd = Math.random, lum = S.lum;
  const parts = [];
  const q = () => (rnd() < 0.5 ? 1 : -1);
  const pj = rnd() * TAU;
  const jets = [[pj, (rnd() * 2 - 1) * 1.7, 4 + 12 * pow(rnd(), 1.5)], [pj + PI + (rnd() - 0.5) * 0.4, (rnd() * 2 - 1) * 1.7, 0]];
  jets[1][2] = jets[0][2] * (0.75 + 0.5 * rnd());
  for (const [phi, eta, pt] of jets) {
    const n = max(4, Math.round((5 + floor(rnd() * 8)) * (1 - 0.35 * lum)));
    const w = [];
    let sw = 0;
    for (let i = 0; i < n; i++) {
      const v = pow(rnd(), 1.7) + 0.03;
      w.push(v);
      sw += v;
    }
    const side = sideOf(phi);
    for (let i = 0; i < n; i++) {
      const pt1 = max(0.8, (pt * w[i]) / sw);
      const sp = 0.22 * (1.3 - min(1, pt1 / 3) * 0.6);
      const u = rnd();
      parts.push({
        k: u < 0.38 ? 0 : u < 0.6 ? 1 : 2, pt1, eta: cl(eta + (rnd() + rnd() - 1) * sp, -2.4, 2.4), phi: phi + (rnd() + rnd() - 1) * sp,
        q: q(), z0: vz, soft: 0, side,
      });
    }
  }
  const ni = 1 + floor(rnd() * 2);
  for (let i = 0; i < ni; i++)
    parts.push({ k: rnd() < 0.5 ? 3 : 0, pt1: 2.5 + 8 * pow(rnd(), 1.5), eta: (rnd() * 2 - 1) * 1.3, phi: rnd() * TAU, q: q(), z0: vz, soft: 0, side: 0 });
  if (rnd() < 1 / 3) parts.push({ k: 4, pt1: 18 + 30 * rnd(), eta: (rnd() * 2 - 1) * 1.4, phi: rnd() * TAU, q: q(), z0: vz, soft: 0, side: 0 });
  let nCh = 0;
  for (const p of parts) if (p.k === 0 || p.k >= 3) nCh++;
  // the tracks already on the panel
  let live = 0;
  for (const e of S.events) if (e.kill < 0 && t0 - e.t0 < e.life * 0.9) live += e.nTrk;
  let nMB = Math.round((2 + 8 * rnd()) * (0.75 + 0.75 * lum));
  const cap = MAXTRK - floor(30 * lum);
  nMB = max(3, min(nMB, cap - live - nCh));
  for (const e of S.events) {
    if (live + nCh + nMB <= cap) break;
    if (e.kill < 0) {
      e.kill = t0;
      live -= e.nTrk;
    }
  }
  // pile-up: more vertices along the beam
  const pv = [vz];
  const nv = 1 + floor(rnd() * (1 + 3 * lum));
  for (let i = 1; i < nv; i++) pv.push(cl(vz + gauss() * 5.5, -11, 11));
  for (let i = 0; i < nMB; i++)
    parts.push({ k: 0, pt1: 0.3 + 1.2 * pow(rnd(), 1.7), eta: (rnd() * 2 - 1) * 2.0, phi: rnd() * TAU, q: q(), z0: pv[floor(rnd() * nv)], soft: 1, side: 0 });
  // a few slower tracks that the field bends into arcs and loops
  const nl = 3;
  for (let i = 0; i < nl; i++)
    parts.push({ k: 0, pt1: 0.45 + 0.65 * rnd(), eta: (rnd() * 2 - 1) * 1.1, phi: rnd() * TAU, q: q(), z0: vz, soft: 2, side: 0 });
  const nn = 2 + floor(rnd() * 4);
  for (let i = 0; i < nn; i++)
    parts.push({ k: rnd() < 0.6 ? 2 : 1, pt1: 1.5 + 4.5 * pow(rnd(), 1.5), eta: (rnd() * 2 - 1) * 2.0, phi: rnd() * TAU, q: 1, z0: vz, soft: 0, side: 0 });
  const rate = S.rate;
  const ls = (1 + 0.35 * cl((0.55 - rate) / 0.25, 0, 1)) * (1 - 0.6 * cl((rate - 0.8) / 1.7, 0, 1));
  const hold = 1.2 * ls, fade = 1.5 * ls;
  return {
    t0, vz, pv, parts, lum, hold, fade, life: TG + hold + fade, kill: -1, nTrk: nCh + nMB + nl, trk: [], tow: [], lnB: 0, lnE: 0,
  };
}

// Put the tracks and the towers of an event on the geometry of the field and the energy now.
function build(S, ev) {
  const B = S.B, E = S.E;
  ev.lnB = S.lnB;
  ev.lnE = S.lnE;
  const trk = [], tw = new Map();
  const lum = ev.lum;
  const dep = (kind, side, zs, phi, pos, ee, eh, t) => {
    const pb = floor(((phi / TAU) - floor(phi / TAU)) * NPHI);
    const bin = kind === 0 ? floor((pos + ZCAL) / TZ) : floor(pos / TRD);
    const key = (((kind * 2 + (side > 0 ? 1 : 0)) * 2 + (zs > 0 ? 1 : 0)) * NPHI + pb) * 32 + bin;
    let w = tw.get(key);
    if (!w) {
      w = { kind, sd: side, zs, phi: ((pb + 0.5) * TAU) / NPHI, pos: kind === 0 ? (bin + 0.5) * TZ - ZCAL : (bin + 0.5) * TRD, ee: 0, eh: 0, t };
      tw.set(key, w);
    }
    w.ee += ee;
    w.eh += eh;
    if (t < w.t) w.t = t;
  };
  const split = (k, pt) => (k === 0 ? [0.3 * pt, 0.7 * pt] : k === 1 ? [0.15 * pt, 0.85 * pt] : k === 4 ? [0.8, 2.2] : [pt, 0]);
  for (const p of ev.parts) {
    const pt = p.pt1 * (p.soft ? pow(E, 0.3) : p.k === 4 ? sqrt(E) : E);
    if (p.k === 1 || p.k === 2) {
      // neutral: a straight line, a tower and no track
      const sh = sinh(p.eta), ch = cosh(p.eta);
      const zh = p.z0 + RCAL * sh;
      const [ee, eh] = split(p.k, pt);
      if (abs(zh) < ZCAL) dep(0, p.side || sideOf(p.phi), 0, p.phi, zh, ee, eh, (RCAL * ch) / VEL);
      else {
        const zs = sh > 0 ? 1 : -1, st = (zs * ZCAL - p.z0) / sh;
        dep(1, p.side || sideOf(p.phi), zs, p.phi, st, ee, eh, (st * ch) / VEL);
      }
      continue;
    }
    const mu = p.k === 4;
    const maxPsi = p.soft ? 3 * PI * (1 - 0.4 * lum) : 3 * PI;
    const maxS = p.soft ? 38 * (1 - 0.35 * lum) : 1e9;
    const tr = trace(pt, p.q, p.phi, p.eta, p.z0, B, maxPsi, mu ? RMU : RCAL, mu ? ZMU : ZCAL, maxS);
    const side = p.side || sideOf(p.phi + p.q * 0.5 * min(tr.psi, PI));
    const n = tr.X.length;
    const ex = new Array(n), ey = new Array(n), sx = new Array(n), sy = new Array(n);
    for (let i = 0; i < n; i++) {
      ex[i] = CX + tr.X[i];
      ey[i] = CY - tr.Y[i];
      sx[i] = AX + tr.Z[i];
      sy[i] = AY - side * hypot(tr.X[i], tr.Y[i]);
    }
    const u = cl(log(pt / 0.4) / log(20), 0, 1);
    const sEnd = tr.S[n - 1];
    trk.push({
      e: resample(ex, ey, tr.S), v: resample(sx, sy, tr.S), I: mu ? 1.05 : p.soft === 2 ? 0.8 * (1 - 0.35 * lum) : p.soft ? 0.34 * (1 - 0.55 * lum) : 0.72 + 0.4 * u, u: floor(u * NR + 0.5),
      mu, soft: p.soft, sEnd, hit: tr.hit,
    });
    if (tr.hit) {
      const [ee, eh] = split(p.k, pt);
      // a muon leaves a little where it crosses the calorimeter on its way to the chambers
      let j = 0;
      if (mu) while (j < n - 1 && hypot(tr.X[j], tr.Y[j]) < RCAL && abs(tr.Z[j]) < ZCAL) j++;
      const qx = mu ? tr.X[j] : tr.px, qy = mu ? tr.Y[j] : tr.py, qz = mu ? tr.Z[j] : tr.z;
      const phiH = atan2(qy, qx);
      if (abs(qz) >= ZCAL - 0.01) dep(1, side, qz > 0 ? 1 : -1, phiH, hypot(qx, qy), ee, eh, (mu ? tr.S[j] : sEnd) / VEL);
      else dep(0, side, 0, phiH, qz, ee, eh, (mu ? tr.S[j] : sEnd) / VEL);
    }
  }
  const tow = [];
  for (const w of tw.values()) {
    let hE = 4.6 * (1 - exp(-w.ee / 3.2)), hH = 9 * (1 - exp(-w.eh / 7));
    const cap = w.kind === 0 ? 11 : 7, tot = hE + hH;
    if (tot > cap) {
      hE *= cap / tot;
      hH *= cap / tot;
    }
    if (hE + hH < 0.9) continue;
    w.hE = hE;
    w.hH = hH;
    tow.push(w);
  }
  ev.trk = trk;
  ev.tow = tow;
}

function alphaOf(ev, age) {
  const u = (age - TG - ev.hold) / ev.fade;
  return u > 0 ? pow(max(0, 1 - u), 1.3) : 1;
}

// ---------------------------------------------------------------- the model

function spawn(S) {
  const ev = genEvent(S, S.nextT, S.nextVz);
  S.events.push(ev);
  build(S, ev);
  const G = 1 / S.rate;
  const gap = min(TG + ev.hold + 0.5 * ev.fade, G * (0.55 + 0.9 * Math.random()));
  S.nextT = ev.t0 + max(0.2, gap);
  S.nextVz = cl(gauss() * 4.2, -10, 10);
}

function advance(S, d) {
  S.t += d;
  while (S.t >= S.nextT) spawn(S);
  let w = 0;
  for (let i = 0; i < S.events.length; i++) {
    const ev = S.events[i];
    if (S.t - ev.t0 >= ev.life || (ev.kill >= 0 && S.t - ev.kill >= 0.3)) continue;
    S.events[w++] = ev;
  }
  S.events.length = w;
}

function setPal(S) {
  const h = S.hue;
  S.hueDone = h;
  const ramp = new Float32Array((NR + 1) * 3);
  for (let i = 0; i <= NR; i++) {
    const c = turned(rampAt(i / NR), h);
    ramp[i * 3] = c[0];
    ramp[i * 3 + 1] = c[1];
    ramp[i * 3 + 2] = c[2];
  }
  S.pal = { ramp, ecal: turned(ECAL, h), hcal: turned(HCAL, h), mu: turned(MUTRK, h), hit: turned(MUHIT, h), flash: turned(FLASH, h), beam: turned(BEAM, h) };
  const cols = [turned(rampAt(0.2), h), S.pal.ecal, S.pal.hcal, S.pal.hit];
  const L = S.lay, bg = S.bg;
  for (let p = 0; p < W * H; p++) {
    const o = p * 4;
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < 4; k++) {
      const v = L[o + k];
      r += v * cols[k][0];
      g += v * cols[k][1];
      b += v * cols[k][2];
    }
    bg[p * 3] = r;
    bg[p * 3 + 1] = g;
    bg[p * 3 + 2] = b;
  }
}

export function setup(params) {
  const lut = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) lut[i] = 1 - exp((-GAIN * (i + 0.5)) / 256);
  params.s = {
    t: 0, init: false, events: [], nextT: 0.2, nextVz: 0,
    hue: 0, hueT: 0, hueDone: -1, lnB: log(3), lnE: 0, lnR: log(0.5), B: 3, E: 1, rate: 0.5, lum: 0.1, lnBT: log(3), lnET: 0, lnRT: log(0.5),
    lay: buildLayers(), bg: new Float32Array(W * H * 3), pal: null,
    dyn: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3), glow: new Float32Array(W * H * 3), lut,
  };
}

function readKnobs(S, kn) {
  S.hueT = cl(kn[0], 0, 1);
  S.lnRT = log(0.3) + (log(2.5) - log(0.3)) * (cl(kn[1], 0, 8) / 8);
  const v = cl(kn[2], -1, 1);
  S.lnBT = log(v < 0 ? 3 * pow(0.4 / 3, -v) : 3 + v);
  S.lnET = cl(kn[3], -1, 1) * Math.LN2;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  readKnobs(S, kn);
  const d = cl(dt || 0, 0, 0.1);
  if (!S.init) {
    S.init = true;
    S.hue = S.hueT;
    S.lnR = S.lnRT;
    S.lnB = S.lnBT;
    S.lnE = S.lnET;
    S.rate = exp(S.lnR);
    S.B = exp(S.lnB);
    S.E = exp(S.lnE);
    S.lum = cl((S.rate - 0.3) / 2.2, 0, 1);
    setPal(S);
    // a minute of collisions has gone by
    for (let i = 0; i < 40 * 30; i++) advance(S, 1 / 30);
    // and the panel opens on an event in full flight, the next one a good gap after it
    for (let i = 0; i < 90; i++) {
      const last = S.events[S.events.length - 1];
      if (last && S.t - last.t0 >= 0.6) {
        S.nextT = last.t0 + min(TG + last.hold + 0.5 * last.fade, 1.1 / S.rate + 0.3);
        break;
      }
      advance(S, 1 / 30);
    }
    return;
  }
  const k = 1 - exp(-d / 0.12), kr = 1 - exp(-d / 0.4), kh = 1 - exp(-d / 0.2);
  S.lnB += (S.lnBT - S.lnB) * k;
  S.lnE += (S.lnET - S.lnE) * k;
  S.lnR += (S.lnRT - S.lnR) * kr;
  S.hue += (S.hueT - S.hue) * kh;
  S.B = exp(S.lnB);
  S.E = exp(S.lnE);
  S.rate = exp(S.lnR);
  S.lum = cl((S.rate - 0.3) / 2.2, 0, 1);
  if (abs(S.hue - S.hueDone) > 0.002) setPal(S);
  advance(S, d);
  for (const ev of S.events) if (abs(S.lnB - ev.lnB) > 0.012 || abs(S.lnE - ev.lnE) > 0.012) build(S, ev);
}

// ---------------------------------------------------------------- drawing

function drawTrack(dyn, arr, sHead, w, c, boost) {
  for (let i = 0; i < arr.length; i += 3) {
    const s = arr[i + 2];
    if (s > sHead) {
      if (boost && i > 0) blob(dyn, arr[i - 3], arr[i - 2], 1.1, 0.55 * w, c);
      return;
    }
    let ww = w * (0.2 + 0.8 * sm(1.5, 11, hypot(arr[i] - arr[0], arr[i + 1] - arr[1])));
    if (boost) ww *= 1 + 1.1 * exp(-(sHead - s) / HEAD);
    splat(dyn, arr[i], arr[i + 1], ww * NORM, c[0], c[1], c[2]);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pal) return;
  const dyn = S.dyn, pal = S.pal, ramp = pal.ramp;
  dyn.fill(0);
  const t = S.t;
  // two bunches come in along the beam
  const rem = S.nextT - t;
  if (rem < BT && rem > 0) {
    const p = 1 - rem / BT, xc = AX + S.nextVz;
    for (let j = 0; j < 6; j++) {
      const pp = p - 0.03 * j;
      if (pp <= 0) break;
      const w = 0.6 * p * (1 - j / 6);
      blob(dyn, 1 + (xc - 1) * pp, AY, 0.95, w, pal.beam);
      blob(dyn, 63 + (xc - 63) * pp, AY, 0.95, w, pal.beam);
    }
    blob(dyn, CX, CY, 2.0, 0.45 * p * p, pal.beam);
  }
  const rgb = [0, 0, 0];
  // the more events are on show, the dimmer each is
  let sa = 0;
  for (const ev of S.events) sa += alphaOf(ev, max(0, t - ev.t0)) * (ev.kill >= 0 ? max(0, 1 - (t - ev.kill) / 0.3) : 1);
  const dim = 1 / (1 + 0.3 * max(0, sa - 1));
  for (const ev of S.events) {
    const age = t - ev.t0;
    if (age < 0) continue;
    const kf = ev.kill >= 0 ? max(0, 1 - (t - ev.kill) / 0.3) : 1;
    const aH = alphaOf(ev, age) * kf, aS = alphaOf(ev, age * (1 + 0.45 * ev.lum)) * kf;
    const sHead = VEL * age;
    const growing = age < TG + 0.15;
    // the vertices
    const fl = exp(-age / 0.07) * 1.5 + 0.3 * exp(-age / 0.4);
    if (fl > 0.02) {
      blob(dyn, CX, CY, 1.2, fl * kf, pal.flash);
      blob(dyn, CX, CY, 2.8, 0.5 * fl * kf, pal.flash);
      for (let i = 0; i < ev.pv.length; i++) {
        const w = i === 0 ? 1 : 0.5;
        blob(dyn, AX + ev.pv[i], AY, 1.2, fl * w * kf, pal.flash);
        blob(dyn, AX + ev.pv[i], AY, 2.8, 0.5 * fl * w * kf, pal.flash);
      }
    }
    for (const tr of ev.trk) {
      const a = tr.soft ? aS : aH;
      if (a < 0.01) continue;
      let c;
      if (tr.mu) c = pal.mu;
      else {
        rgb[0] = ramp[tr.u * 3];
        rgb[1] = ramp[tr.u * 3 + 1];
        rgb[2] = ramp[tr.u * 3 + 2];
        c = rgb;
      }
      const w = tr.I * a * dim * (1 - 0.3 * ev.lum) * (tr.mu ? 1 : 1 + 0.3 * (1 - tr.u / NR));
      drawTrack(dyn, tr.e, sHead, w, c, growing && !tr.soft);
      drawTrack(dyn, tr.v, sHead, w, c, growing && !tr.soft);
      if (tr.mu && sHead >= tr.sEnd - 0.5) {
        for (const arr of [tr.e, tr.v]) {
          const n = arr.length, j = max(0, n - 3 - 3 * 4);
          blob(dyn, arr[n - 3], arr[n - 2], 1.0, 1.6 * a, pal.hit);
          blob(dyn, arr[j], arr[j + 1], 1.0, 1.2 * a, pal.hit);
        }
      }
    }
    for (const w of ev.tow) {
      const g = sm(0, 0.14, age - w.t) * aH * dim;
      if (g < 0.01) continue;
      const hE = w.hE * sm(0, 0.14, age - w.t), hH = w.hH * sm(0, 0.14, age - w.t);
      const cos_ = cos(w.phi), sin_ = sin(w.phi);
      if (w.kind === 0) {
        const x = AX + w.pos, dir = -w.sd;
        const ex = CX + RCAL * cos_, ey = CY - RCAL * sin_;
        bar(dyn, ex, ey, ex + hE * cos_, ey - hE * sin_, 0.95, 0.85 * g, pal.ecal);
        bar(dyn, ex + hE * cos_, ey - hE * sin_, ex + (hE + hH) * cos_, ey - (hE + hH) * sin_, 0.95, 0.85 * g, pal.hcal);
        bar(dyn, x, AY + dir * RCAL, x, AY + dir * (RCAL + hE), 0.9, 0.85 * g, pal.ecal);
        bar(dyn, x, AY + dir * (RCAL + hE), x, AY + dir * (RCAL + hE + hH), 0.9, 0.85 * g, pal.hcal);
      } else {
        const ex = CX + w.pos * cos_, ey = CY - w.pos * sin_;
        disc(dyn, ex, ey, 0.6 + 0.2 * hH, 0.55 * g, pal.hcal);
        disc(dyn, ex, ey, 0.5 + 0.28 * hE, 0.7 * g, pal.ecal);
        const y = AY - w.sd * w.pos;
        bar(dyn, AX + w.zs * ZCAL, y, AX + w.zs * (ZCAL + hE), y, 0.9, 0.85 * g, pal.ecal);
        bar(dyn, AX + w.zs * (ZCAL + hE), y, AX + w.zs * (ZCAL + hE + hH), y, 0.9, 0.85 * g, pal.hcal);
      }
    }
  }
  // a soft halo of everything that moves: 1 4 6 4 1 across and down
  const tmp = S.tmp, glow = S.glow;
  for (let y = 0; y < H; y++) {
    const row = y * W * 3;
    for (let x = 0; x < W; x++) {
      const a2 = x > 1 ? 6 : x > 0 ? 3 : 0, a1 = x > 0 ? 3 : 0, b1 = x < W - 1 ? 3 : 0, b2 = x < W - 2 ? 6 : x < W - 1 ? 3 : 0;
      const i = row + x * 3;
      for (let c = 0; c < 3; c++) {
        const j = i + c;
        tmp[j] = (dyn[j - a2] + dyn[j + b2] + 4 * (dyn[j - a1] + dyn[j + b1]) + 6 * dyn[j]) * 0.0625;
      }
    }
  }
  const stride = W * 3;
  for (let y = 0; y < H; y++) {
    const a2 = y > 1 ? 2 : y > 0 ? 1 : 0, b2 = y < H - 2 ? 2 : y < H - 1 ? 1 : 0, a1 = y > 0 ? 1 : 0, b1 = y < H - 1 ? 1 : 0;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const j = row + x;
      glow[j] = (tmp[j - a2 * stride] + tmp[j + b2 * stride] + 4 * (tmp[j - a1 * stride] + tmp[j + b1 * stride]) + 6 * tmp[j]) * 0.0625;
    }
  }
  const bg = S.bg, lut = S.lut;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = bg[i] + dyn[i] + 0.35 * glow[i], g = bg[i + 1] + dyn[i + 1] + 0.35 * glow[i + 1], b = bg[i + 2] + dyn[i + 2] + 0.35 * glow[i + 2];
      const m = max(r, g, b);
      if (m < 1e-4) display.setPixel(x, y, 0, 0, 0);
      else {
        // the brightest channel is soft-clipped and the other two follow it, so crossing tracks mix colours and do not go white
        const f = (255 * lut[min(1023, (m * 256) | 0)]) / m;
        display.setPixel(x, y, Math.round(r * f), Math.round(g * f), Math.round(b * f));
      }
    }
  }
}
