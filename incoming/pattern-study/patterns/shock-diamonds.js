// ===== Patternflow pattern =====
// Title:   Shock Diamonds
// Family:  supersonic
// Idea:    A supersonic jet runs down the dark panel from above, and the shocks stand in it as a chain of bright diamonds that shorten and fade downstream, with a flat Mach disk in the first cell when the pressure is high.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Prandtl's shock-cell spacing for an underexpanded jet (Ludwig Prandtl, 1904), L = 1.3 D sqrt(M^2 - 1); the Mach disk at about 0.67 D sqrt(p0/pa) from the nozzle (Ashkenas and Sherman, 1966, from memory)
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pressure=0..4, Nozzle=-1..1, Unsteady=-1..1
//
// Knob 1: Hue. The colour of the heat: a blue-white core inside an orange sheath where the knob opens, and one turn round the wheel from there, the core always 0.55 of a turn from the sheath.
// Knob 2: Pressure. The pressure ratio in the chamber, 4 at the bottom, 12.6 where the knob opens and 40 at the top. The first diamonds stand 17 LEDs apart at the bottom and 28 at the top. The first cell turns into a flat Mach disk from a ratio of 6 and is all disk from 16.
// Knob 3: Nozzle. The width of the jet where it comes in, 10 LEDs at the bottom, 14 where the knob opens and 18 at the top. The cells grow and shrink with it: about ten diamonds down the panel at the bottom, four at the top.
// Knob 4: Unsteady. How much the jet is shaken. At the bottom the edge stays within half an LED, the jet hardly sways and the diamonds hold their light; at the top the edge rolls by up to a third of the jet's radius, the tail sways by several LEDs and each diamond flickers on a beat of its own. The chamber pressure rocks at every setting, more as the knob goes up.

const W = 64;
const H = 128;
// The nozzle is 2 LEDs above the panel, and s is the distance down the jet from it.
const NOZ = -2;
const CX = 32;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// The chamber pressure rocks on five beats that do not divide one another, and each beat runs on down the jet.
function rocking(s, t) {
  return (
    0.45 * Math.sin(0.211 * t - 0.021 * s + 0.8) +
    0.35 * Math.sin(0.5817 * t - 0.052 * s + 2.4) +
    0.25 * Math.sin(1.3239 * t - 0.09 * s + 4.1) +
    0.3 * Math.sin(0.3571 * t - 0.034 * s + 1.3) +
    0.25 * Math.sin(0.8123 * t - 0.071 * s + 5.2)
  );
}

export function setup(params) {
  params.t = 0;
  params.cx = new Float32Array(H);
  params.rl = new Float32Array(H);
  params.rr = new Float32Array(H);
  params.ds = new Float32Array(H);
  params.hd = new Float32Array(H);
  params.wd = new Float32Array(H);
  params.amp = new Float32Array(H);
  params.disk = new Float32Array(H);
  params.gap = new Float32Array(H);
  params.lvl = new Float32Array(H);
  params.cb = new Float32Array(3);
  params.cw = new Float32Array(3);
  params.cd = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const su = clamp((k[3] + 1) / 2, 0, 1);
  const hue = k[0];
  hsv(hue + 0.07, 0.92, 1, params.cw);
  hsv(hue + 0.62, 0.5, 1, params.cb);
  hsv(hue + 0.6, 0.05, 1, params.cd);

  // Pressure ratio of the chamber, rocking about the knob's value.
  const npr0 = 4 * Math.pow(10, clamp(k[1], 0, 4) / 4);
  const ap = 0.14 + 0.16 * su;
  const rock = rocking(0, t);
  const npr = npr0 * (1 + ap * rock);
  const mj = Math.sqrt(5 * (Math.pow(npr, 2 / 7) - 1));
  const dn = 14 * (1 + 0.3 * clamp(k[2], -1, 1)) * (1 + 0.05 * Math.sin(0.137 * t + 1.1) + 0.04 * Math.sin(0.3313 * t + 3));
  const lam = 5.5 * dn;
  const diskMix = smooth(6, 16, npr);
  const spread = (0.085 + 0.05 * su) * (1 + 0.2 * Math.sin(0.0817 * t + 0.5));
  const eps0 = 0.03 + 0.25 * su;
  const sway = 0.3 + 6 * su;
  const flick = 0.08 + 0.5 * su;
  const wander = 0.03 + 0.1 * su;
  const ampBase = 1.1 + 0.25 * clamp((mj - 1.4) / 1.4, 0, 1);

  let phi = 0;
  let sPrev = 0;
  for (let y = 0; y < H; y++) {
    const s = y + 0.5 - NOZ;
    // Cell phase: the integral of 1 / L down the jet, L = 1.3 D sqrt(M^2 - 1) with the Mach number falling as the jet mixes.
    // A floor under M^2 - 1 keeps the cells of a weak jet from shrinking below about ten LEDs.
    const sm = (s + sPrev) / 2;
    const m = 1 + (mj - 1) * Math.exp(-sm / lam);
    const len = Math.max(6, 1.3 * dn * Math.sqrt(Math.max(m * m - 1, 0.65)) * (1 + 0.5 * ap * (rocking(sm, t) - rock)));
    phi += (s - sPrev) / len;
    sPrev = s;
    const mm = 1 + (mj - 1) * Math.exp(-s / lam);
    const L = Math.max(6, 1.3 * dn * Math.sqrt(Math.max(mm * mm - 1, 0.65)) * (1 + 0.5 * ap * (rocking(s, t) - rock)));

    // Diamonds sit at phase 0.4, 1.4, ... of the cells; the first one becomes the disk and moves down as the pressure rises.
    // Each diamond drifts a little about its place and swells and thins on a beat of its own.
    let idx = 0;
    let dphi = 9;
    for (let j = Math.max(0, Math.floor(phi) - 1); j <= Math.floor(phi) + 1; j++) {
      const c = j + 0.4 + (j === 0 ? 0.22 * diskMix : 0) + wander * Math.sin((0.37 + 0.1613 * j) * t + 1.7 * j);
      if (Math.abs(phi - c) < Math.abs(dphi)) {
        dphi = phi - c;
        idx = j;
      }
    }
    const first = idx === 0;
    const dm = first ? diskMix : 0;
    params.ds[y] = dphi * L;
    const dFrac = Math.abs(dphi);

    const rad = 0.5 * (dn + spread * s);
    // The jet narrows a little where the diamonds are and swells in the gaps.
    // Cells shorter than about seven LEDs fade out, with their diamonds and the swelling of the jet, so that no chain of thin stripes is left.
    const fc = smooth(2.2, 4.2, 0.34 * L);
    const rb = rad * (1 + 0.09 * fc * Math.cos(2 * Math.PI * (phi - 0.4)) + (first ? 0.1 * dm * Math.sin(Math.PI * phi) : 0));

    // Shear-layer rolls: a few waves that run down the jet, a different set on each side.
    const eps = eps0 * (0.3 + 0.7 * Math.min(1, s / 100));
    const nl = 0.5 * Math.sin(0.3 * s - 3.0 * t + 0.4) + 0.35 * Math.sin(0.19 * s - 1.9 * t + 2.0) + 0.25 * Math.sin(0.115 * s - 1.15 * t + 4.4);
    const nr = 0.5 * Math.sin(0.27 * s - 2.7 * t + 3.1) + 0.35 * Math.sin(0.165 * s - 1.65 * t + 5.6) + 0.25 * Math.sin(0.1 * s - 1.0 * t + 1.2);
    params.rl[y] = rb * (1 + eps * nl);
    params.rr[y] = rb * (1 + eps * nr);

    // The jet sways more the further it goes.
    const ramp = Math.pow(Math.min(1, s / 130), 1.3);
    params.cx[y] = CX + sway * ramp * (Math.sin(0.43 * t - 0.035 * s) + 0.6 * Math.sin(0.97 * t - 0.06 * s + 1.3) + 0.4 * Math.sin(0.2917 * t - 0.02 * s + 2.2));

    // Diamond size: half-width of the diamond, half-height of it, and how bright it is.
    const wdm = (0.67 - 0.1 * dm) * rb * (1 + 0.7 * wander * Math.sin((0.53 + 0.1219 * idx) * t + 0.9 * idx + 2));
    const hdm = first ? 0.34 * L * (1 - dm) + 2.6 * dm : 0.34 * L;
    params.wd[y] = wdm;
    params.hd[y] = Math.max(0.5, hdm);
    const size = Math.min(wdm, 0.34 * L);
    let a = ampBase * Math.exp(-s / 150) * smooth(2, 3.8, size) * fc;
    a *= 1 - flick * (0.5 + 0.3 * Math.sin((0.83 + 0.2371 * idx) * t + 2.3 * idx) + 0.2 * Math.sin((1.57 + 0.1873 * idx) * t + 5.1 * idx + 1));
    params.amp[y] = a;
    params.disk[y] = dm;
    params.gap[y] = smooth(0.34, 0.5, dFrac) * fc;
    params.lvl[y] = Math.pow(dn / (dn + spread * s), 0.35) * Math.exp(-s / 450);
  }
}

export function draw(display, params) {
  const { cx, rl, rr, ds, hd, wd, amp, disk, gap, lvl, cb, cw, cd } = params;
  for (let y = 0; y < H; y++) {
    const c = cx[y];
    const d = ds[y];
    const adx = Math.abs(d);
    const g = gap[y];
    const lv = lvl[y];
    const w = wd[y];
    const h = hd[y];
    const dm = disk[y];
    const mn = Math.min(w, h);
    const am = amp[y];
    for (let x = 0; x < W; x++) {
      const r = x + 0.5 - c;
      const a = Math.abs(r);
      const R = r < 0 ? rl[y] : rr[y];
      const e = a - R;
      // The sheath: a glow that peaks just inside the edge, thicker in a wide jet, and runs out over a few LEDs beyond it.
      const sig = e < 0 ? 0.3 * R : 1.8 + 0.05 * R;
      const z = (e + 1.2) / sig;
      if (z > 3.2) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const sheath = Math.exp(-z * z);
      const u = a / R;
      const core = 1 - smooth(0, 0.75, u);
      const aw = a / w;
      const bw = adx / h;
      const qe = Math.sqrt(aw * aw + bw * bw);
      // A diamond with its points blunted a little; the disk is an ellipse.
      const qd = 0.62 * (aw + bw) + 0.38 * qe;
      const q = qd + (qe - qd) * dm;
      const id = clamp(((1 - q) * mn) / 1.6, 0, 1);
      const dia = smooth(0, 1, id) * am * (1 + 0.2 * id * id);
      const cv = core * (0.18 + 0.27 * (1 - g)) * (1 - 0.7 * Math.min(1, dia));
      const sv = sheath * (0.8 - 0.2 * g) * lv;
      display.setPixel(
        x,
        y,
        clamp(cb[0] * cv + cw[0] * sv + cd[0] * dia, 0, 1) * 255,
        clamp(cb[1] * cv + cw[1] * sv + cd[1] * dia, 0, 1) * 255,
        clamp(cb[2] * cv + cw[2] * sv + cd[2] * dia, 0, 1) * 255,
      );
    }
  }
}
