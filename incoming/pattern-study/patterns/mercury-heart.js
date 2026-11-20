// ===== Patternflow pattern =====
// Title:   Mercury Heart
// Family:  liquidmetal
// Idea:    Seen from straight above, a pool of mercury in a dark dish of acid beats where an unseen iron wire touches its rim, flattening and pulling back one to three times a second while its rim breaks into a star of soft lobes whose number keeps changing, its chrome surface mirroring a room with a bright window and a warm lamp, and faint rings spread over the acid from every beat.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the mercury beating heart, explained by Gabriel Lippmann's electrocapillarity (1875), with the star-shaped modes Kuhn and Keizer studied
// Round:   201
// ===============================
// @matrix 64x128
// @knobs Room=0..1, Beat=0..3, Lobes=-1..1, Swing=-1..1
//
// Knob 1: Room. The tint of the room the mercury and the acid mirror, once round the colour wheel. Where the knob opens it is a steel-blue ceiling, a white window and a warm lamp; a quarter round the mercury turns plum with green lights, halfway brass with cyan, three quarters green with pink, and away from the opening the tint grows richer.
// Knob 2: Beat. How fast the heart beats: about 1.9 beats a second where the knob opens and 2.8 at the top, each beat a little longer or shorter than the last. At the bottom the drop stops beating, sends out no rings and only sways its lobes, once in about half a minute.
// Knob 3: Lobes. The mode the rim favours, and with it the size of the pool, since a bigger pool has room for more lobes: three lobes on a pool 38 LEDs across at the bottom, four to seven (mostly five and six) on 42 LEDs where the knob opens, eight and nine on 46 LEDs at the top.
// Knob 4: Swing. How hard each beat throws the drop. At the bottom the rim only quivers half an LED and the rings are barely there; where the knob opens the lobes swing about 2.4 LEDs and the pool spreads 1.6; at the top the lobes reach about 4 LEDs into deep arms, the pool spreads 2.6 and the rings run bright.

const W = 64;
const H = 128;
const TAU = 6.283185307179586;
// The pool at rest, its radius in LEDs where the lobes knob opens, and how tall its dome stands as a share of the radius.
const R0 = 21;
const DOME = 0.42;
// The camera hangs this many LEDs above the dish, so the reflections tilt toward the panel's ends. The acid is
// drawn as if from a little lower, so the window it mirrors reaches into the panel.
const CAM = 62;
const CAM_DISH = 24;
// The rim, sampled round the drop at this many angles each frame.
const NA = 1024;
// Ripples, one constant a line: speed in LEDs a second, wavelength, packet half-width, height, fade time.
const RIP_V = 17;
const RIP_L = 7.5;
const RIP_W = 4.5;
const RIP_A = 0.35;
const RIP_T = 2.0;
// How much of the room the acid mirrors.
const DISH_REFL = 0.17;
// The lamp, about this far round from the window and this high, in radians.
const LAMP_A = 1.2;
const LAMP_E = 0.5;
// Mercury's reflectance.
const HG = 0.88;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function setup(params) {
  params.started = false;
  params.t = 0;
  params.bp = 0;
  params.str = 1;
  params.durF = 1;
  params.psi = 0;
  params.rot = 0;
  params.room = 0;
  params.ra = 0;
  params.la = 0;
  params.modes = [];
  params.off = 0;
  params.nextSwitch = 0;
  params.ripples = [];
  params.swingS = 0;
  params.sizeS = 1;
  params.beatS = 2;
  params.hue = 0;
  params.ph = new Float32Array(8);
  params.hm = new Float32Array([1, 0, 0]);
  params.rim = new Float32Array(NA + 1);
  params.dish = new Float32Array(W * H * 3);
  params.hg = new Float32Array((2 * W + 2) * (2 * H + 2));
  params.dg = new Float32Array((2 * W + 2) * (2 * H + 2));
  params.out = new Float32Array(W * H * 3);
  params.er = 0;
  params.eg = 0;
  params.eb = 0;
  params.cx = 32;
  params.cy = 64;
  params.R = R0;
  params.Hd = DOME * R0;
  params.spread = 0;
  params.sw = 0.5;
  params.starA = 0;
  params.mood = 1;
  params.starB = 0;
  params.strS = 1;
}

// A new mode for the rim: n lobes at a fresh angle from the touch point, with a weaker companion mode for irregular lobes.
function addMode(params, n, fade) {
  for (const m of params.modes) m.wt = 0;
  const n2 = n + (Math.random() < 0.5 ? 1 : -1);
  params.modes.push({
    n,
    rel: Math.random() * TAU,
    w: params.modes.length ? 0 : 1,
    wt: 1,
    fade,
    n2: Math.max(2, n2),
    rel2: Math.random() * TAU,
    a2: 0.55 + 0.3 * Math.random(),
  });
}

function targetMode(params, nfav) {
  return clamp(Math.round(nfav + params.off), 3, 9);
}

function init(params, k) {
  params.started = true;
  for (let i = 0; i < 8; i++) params.ph[i] = Math.random() * TAU;
  params.psi = Math.random() * TAU;
  params.swingS = clamp(k[3], -1, 1);
  params.sizeS = 1 + 0.09 * clamp(k[2], -1, 1);
  params.beatS = clamp(k[1], 0, 3);
  params.off = (Math.random() * 2 - 1) * 1.1;
  addMode(params, targetMode(params, 5.5 + 3.5 * clamp(k[2], -1, 1)), 1);
  params.nextSwitch = 3 + 4 * Math.random();
  params.bp = Math.random();
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (!params.started) init(params, k);
  dt = Math.min(dt, 0.1);
  params.t += dt;
  const t = params.t;
  const ph = params.ph;
  params.hue = k[0];
  const nfav = 5.5 + 3.5 * clamp(k[2], -1, 1);
  // A bigger pool has room for more lobes round its rim, so the lobes knob also sets the size, a little.
  params.sizeS += (1 + 0.09 * clamp(k[2], -1, 1) - params.sizeS) * (1 - Math.exp(-dt / 0.4));
  params.swingS += (clamp(k[3], -1, 1) - params.swingS) * (1 - Math.exp(-dt / 0.25));
  params.beatS += (clamp(k[1], 0, 3) - params.beatS) * (1 - Math.exp(-dt / 0.3));
  const beat = params.beatS;
  const active = smooth(0, 0.35, beat);

  // The beat: its rate wanders and every beat has its own length and strength.
  const f = (0.06 + 0.9 * beat) * (1 + 0.13 * Math.sin(0.41 * t + ph[0]) + 0.07 * Math.sin(1.13 * t + ph[1])) * params.durF;
  const before = Math.floor(params.bp);
  params.bp += f * dt;
  if (Math.floor(params.bp) !== before) {
    params.str = 0.7 + 0.45 * Math.random();
    params.durF = 0.85 + 0.3 * Math.random();
    params.psi += (Math.random() - 0.5) * 0.6;
    if (active > 0.05) {
      // The ring leaves strongest off the lobe tips, so it carries the drop's mode out over the acid.
      const md = params.modes[params.modes.length - 1];
      const tip = params.psi + md.rel + params.rot + (Math.floor(params.bp) % 2 === 0 ? 0 : Math.PI / md.n);
      params.ripples.push({ x: params.cx, y: params.cy, r0: params.R * 1.04, age: 0, a: params.str * active * (0.1 + 1.7 * params.sw), cw: Math.cos(params.psi), sw: Math.sin(params.psi), n: md.n, tip: md.n * tip });
    }
  }
  const q = params.bp - Math.floor(params.bp);
  const pulse = Math.sin(Math.PI * Math.pow(q, 0.65));
  // The swing knob sets how hard each beat throws the drop: how far it flattens, how deep the lobes go, how high the rings run.
  params.sw = 0.5 + 0.5 * params.swingS;
  params.spread = active * params.str * pulse * pulse;
  // The rim rings at half the beat: the main mode peaks as the drop spreads and flips from beat to beat, so its lobes
  // stand where the last beat had hollows. Its companion rings out of step with it, so the rim is never round and
  // never one clean star.
  params.strS += (params.str - params.strS) * (1 - Math.exp(-dt / 0.15));
  const lob = (0.4 + 0.6 * active) * params.strS;
  params.starA = lob * Math.cos(Math.PI * (params.bp - 0.34));
  params.starB = lob * Math.sin(Math.PI * (params.bp - 0.34) + 1.0);

  // Which mode the rim rings in: it changes every few seconds, or at once when the knob asks for another.
  if (t >= params.nextSwitch) {
    params.off = (Math.random() * 2 - 1) * 1.1;
    params.nextSwitch = t + 3.5 + 5.5 * Math.random();
    const n = targetMode(params, nfav);
    const last = params.modes[params.modes.length - 1];
    if (n !== last.n || Math.random() < 0.4) addMode(params, n, 1.2 + 0.6 * Math.random());
  } else {
    const n = targetMode(params, nfav);
    const last = params.modes[params.modes.length - 1];
    if (n !== last.n) addMode(params, n, 0.6);
  }
  const ms = params.modes;
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i];
    const step = dt / m.fade;
    m.w = m.wt > m.w ? Math.min(m.wt, m.w + step) : Math.max(m.wt, m.w - dt / ms[ms.length - 1].fade);
    m.rel += dt * 0.05 * Math.sin(0.3 * t + i);
    if (m.wt === 0 && m.w <= 0) ms.splice(i, 1);
  }

  // The drop drifts a little and turns slowly.
  params.rot += dt * (0.025 + 0.06 * Math.sin(0.031 * t + ph[2]));
  params.psi += dt * 0.04 * Math.sin(0.019 * t + ph[3]);
  params.cx = 32 + 3.6 * Math.sin(0.088 * t + ph[4]) + 1.4 * Math.sin(0.217 * t + ph[5]);
  params.cy = 64 + 9 * Math.sin(0.066 * t + ph[6]) + 4.5 * Math.sin(0.17 * t + ph[7]);
  // How wildly it beats wanders too: some stretches gentle, some deep.
  params.mood = 0.92 + 0.3 * Math.sin(0.053 * t + ph[1]) * (0.6 + 0.4 * Math.sin(0.023 * t + ph[3]));
  // The dish turns under the room, once in about four and a half minutes at a pace that wanders, so the window walks round the drop.
  params.room += dt * 0.026 * (1 + 0.25 * Math.sin(0.029 * t + ph[0]) + 0.15 * Math.sin(0.071 * t + ph[1]));
  // The pool also spreads and gathers itself slowly, by a few per cent.
  const breathe = 0.008 * Math.sin(1.1 * t) + 0.005 * Math.sin(1.73 * t + 1) + 0.065 * Math.sin(0.153 * t + ph[2]);
  const fl = (0.025 + 0.1 * params.sw) * params.spread * params.mood;
  const R1 = R0 * params.sizeS;
  params.R = R1 * (1 + fl + breathe);
  params.Hd = DOME * R1 * (R1 / params.R) * (R1 / params.R) * (1 - 0.6 * fl);

  const rp = params.ripples;
  for (let i = rp.length - 1; i >= 0; i--) {
    rp[i].age += dt;
    if (rp[i].age > 4.5) rp.splice(i, 1);
  }
  if (rp.length > 12) rp.splice(0, rp.length - 12);
}

// How far a mode of n lobes swings, as a share of a five-lobed one: fewer lobes swing further, and many lobes only ripple the rim.
function modeAmp(n) {
  return n <= 5 ? Math.pow(5 / n, 1.5) : Math.pow(5 / n, 2);
}

// The rim's radius as a share of R, round the drop.
function buildRim(params) {
  const rim = params.rim;
  const t = params.t;
  const psi = params.psi;
  const amp = (0.025 + 0.17 * params.sw) * params.mood;
  const sp = params.spread;
  const ph = params.ph;
  for (let i = 0; i <= NA; i++) {
    const th = (i / NA) * TAU;
    let m = 0;
    for (const md of params.modes) {
      if (md.w <= 0) continue;
      const a = amp * md.w;
      const phi = psi + md.rel + params.rot;
      // Lobes near the wire swing further.
      m += a * params.starA * modeAmp(md.n) * Math.cos(md.n * (th - phi)) * (1 + 0.4 * Math.cos(th - psi));
      m += a * params.starB * md.a2 * modeAmp(md.n2) * Math.cos(md.n2 * (th - psi - md.rel2 - params.rot));
    }
    m += 0.035 * sp * Math.cos(th - psi) + 0.03 * sp * Math.cos(2 * (th - psi));
    m += 0.012 * Math.cos(2 * th - 0.4 * t) * Math.sin(1.9 * t) + 0.008 * Math.cos(3 * th + 0.25 * t) * Math.sin(2.7 * t + 1);
    // A slow lopsidedness the drop never quite loses, so it is never a true circle.
    m += 0.045 * Math.sin(0.13 * t + ph[0]) * Math.cos(2 * (th - ph[1] - 0.07 * t)) + 0.035 * Math.sin(0.089 * t + ph[2]) * Math.cos(3 * (th - ph[3] + 0.05 * t));
    rim[i] = m;
  }
}

// The room as the mercury sees it, for a direction pointing up; writes er, eg, eb. A cool sky gradient overhead
// going to a warm grey wall at the horizon, light on the walls just above it, a bright window and a warm lamp
// beside it. soft blurs the window's edges, for the acid, which is a duller mirror.
function sky(rx, ry, rz, P, soft) {
  const z = rz < 0 ? 0 : rz;
  const side = rx * P.wx + ry * P.wy;
  const sd = 0.5 + 0.5 * side;
  const f = 1 - z;
  let r = 0.17 + 0.13 * side + (0.42 + 0.3 * sd - 0.17 - 0.13 * side) * f;
  let g = 0.21 + 0.16 * side + (0.37 + 0.4 * sd - 0.21 - 0.16 * side) * f;
  let b = 0.3 + 0.2 * side + (0.33 + 0.52 * sd - 0.3 - 0.2 * side) * f;
  const e = Math.asin(z);
  const ch = rx * rx + ry * ry;
  if (e < 1.25 && ch > 1e-8) {
    let a = Math.atan2(ry, rx) - P.ra;
    a -= TAU * Math.round(a / TAU);
    const sf = soft ? 0.14 : 0;
    // Light on the walls just above the horizon, brighter in some directions than others.
    const hb = smooth(-sf, 0.05 + sf, e) * smooth(0.5 + sf, 0.1, e) * (0.24 + 0.16 * Math.cos(2 * a + 0.8) + 0.1 * Math.cos(3 * a - 0.4));
    r += hb * 0.95;
    g += hb * 0.92;
    b += hb * 0.85;
    // The big window, with one mullion down its middle.
    const da = a < 0 ? -a : a;
    let inW = smooth(0.74 + sf, 0.68 - sf, da) * smooth(0.04 - sf, 0.08 + sf, e) * smooth(0.8 + sf, 0.74 - sf, e);
    if (!soft) inW *= smooth(0.06, 0.12, da);
    if (inW > 0) {
      // Clouds go over: the window dims a little and turns from cool white to a warm sunlit white and back.
      const ct = P.t;
      const cloud = Math.sin(4.1 * a + 2.3 * e - 0.23 * ct + 1.1 * Math.sin(1.7 * e + 0.07 * ct)) * Math.sin(2.6 * a - 3.4 * e + 0.17 * ct);
      const s = P.sky * (0.86 + 0.24 * cloud);
      const k = clamp(e / 0.8, 0, 1);
      const sun = P.sun;
      r += ((1.1 - 0.25 * k + 0.05 * sun) * s - r) * inW;
      g += ((1.1 - 0.15 * k + 0.01 * sun) * s - g) * inW;
      b += ((1.1 - 0.12 * sun) * s - b) * inW;
    }
    // The warm lamp beside the window: a wide shade, so its reflection is a short streak, not a dot.
    let dl = a - P.la;
    dl -= TAU * Math.round(dl / TAU);
    const ex = dl * Math.cos(e);
    const ey = e - LAMP_E;
    const qq = (ex * ex) / 0.04 + (ey * ey) / 0.01;
    if (qq < 30) {
      const core = Math.exp(-qq);
      const halo = Math.exp(-qq * 0.12);
      const lp = P.lamp;
      r += (1.6 * core + 0.45 * halo) * lp;
      g += (1.25 * core + 0.24 * halo) * lp;
      b += (0.75 * core + 0.06 * halo) * lp;
    }
  }
  P.er = r;
  P.eg = g;
  P.eb = b;
}

function env(rx, ry, rz, P, soft) {
  if (rz >= 0) {
    sky(rx, ry, rz, P, soft);
    return;
  }
  // Below the horizon: the dark bench, and near the horizon the acid mirrors the room again.
  sky(rx, ry, -rz, P, soft);
  const f = 0.5 * Math.exp(rz * 7);
  P.er = 0.17 + P.er * f;
  P.eg = 0.16 + P.eg * f;
  P.eb = 0.15 + P.eb * f;
}

function frame(P) {
  const t = P.t;
  const ph = P.ph;
  const room = -Math.PI / 2 - 0.45 + P.room;
  P.ra = room;
  P.wx = Math.cos(room);
  P.wy = Math.sin(room);
  // The room's tint: its colours turn round the grey axis, whites and greys stay.
  const a = TAU * P.hue;
  const c = Math.cos(a);
  const sA = Math.sin(a) / Math.sqrt(3);
  const kk = (1 - c) / 3;
  P.hm[0] = c + kk;
  P.hm[1] = kk - sA;
  P.hm[2] = kk + sA;
  P.sky = 0.8 + 0.22 * Math.sin(0.13 * t + ph[2]) * (0.7 + 0.3 * Math.sin(0.051 * t));
  P.sun = clamp(0.5 + 0.8 * Math.sin(0.089 * t + ph[3]), 0, 1);
  P.lamp = 0.8 + 0.35 * Math.sin(0.083 * t + ph[5]);
  // The lamp is not fixed: it wanders along the wall on its own, now beside the window, now well round from it.
  P.la = LAMP_A + 0.75 * Math.sin(0.047 * t + ph[6]) + 0.3 * Math.sin(0.113 * t + ph[7]);
}

export function draw(display, params) {
  const P = params;
  frame(P);
  buildRim(P);
  const dish = P.dish;
  const rp = P.ripples;
  const rk = TAU / RIP_L;

  // The acid: dark, mirroring the room faintly, rippled by the rings from every beat.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let gx = 0;
      let gy = 0;
      let crest = 0;
      for (let i = 0; i < rp.length; i++) {
        const r = rp[i];
        const dx = px - r.x;
        const dy = py - r.y;
        const rho = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        const s = rho - (r.r0 + RIP_V * r.age);
        if (s > 2.2 * RIP_W || s < -2.2 * RIP_W) continue;
        const e = Math.exp(-(s * s) / (RIP_W * RIP_W));
        // Stronger on the side of the wire, so each ring is a crescent more than a circle.
        const lobe = 0.5 + 0.5 * Math.cos(r.n * Math.atan2(dy, dx) - r.tip);
        const side = (0.55 + 0.45 * ((dx * r.cw + dy * r.sw) / rho)) * (0.3 + 0.7 * lobe);
        const a = RIP_A * r.a * side * Math.exp(-r.age / RIP_T) * Math.sqrt(r.r0 / Math.max(rho, r.r0)) * smooth(0, 3, rho - r.r0);
        const cs = Math.cos(rk * s);
        const sn = Math.sin(rk * s);
        const dh = a * e * ((-2 * s * cs) / (RIP_W * RIP_W) - rk * sn);
        gx += (dh * dx) / rho;
        gy += (dh * dy) / rho;
        crest += a * e * cs;
      }
      const vx = (px - 32) / CAM_DISH;
      const vy = (py - 64) / CAM_DISH;
      const vl = 1 / Math.sqrt(vx * vx + vy * vy + 1);
      const dx = vx * vl;
      const dy = vy * vl;
      const dz = -vl;
      const nl = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      const nx = -gx * nl;
      const ny = -gy * nl;
      const nz = nl;
      const dn = 2 * (dx * nx + dy * ny + dz * nz);
      env(dx - dn * nx, dy - dn * ny, dz - dn * nz, P, true);
      const ring = crest > 0 ? crest * 0.6 : 0;
      const o = (y * W + x) * 3;
      dish[o] = 0.075 + DISH_REFL * P.er + ring;
      dish[o + 1] = 0.095 + DISH_REFL * P.eg + ring;
      dish[o + 2] = 0.11 + DISH_REFL * P.eb + ring;
    }
  }

  const out = P.out;
  out.set(dish);

  // The drop: a dome whose outline is the lobed rim, shaded as a mirror at four samples to the LED.
  const R = P.R;
  const Hd = P.Hd;
  const cx = P.cx;
  const cy = P.cy;
  const rim = P.rim;
  let mmax = 0;
  for (let i = 0; i < NA; i++) if (rim[i] > mmax) mmax = rim[i];
  const reach = R * (1 + mmax) + 2;
  const x0 = Math.max(0, Math.floor(cx - reach));
  const x1 = Math.min(W - 1, Math.ceil(cx + reach));
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(H - 1, Math.ceil(cy + reach));
  const gw = 2 * (x1 - x0 + 1) + 2;
  const gh = 2 * (y1 - y0 + 1) + 2;
  const hg = P.hg;
  const dg = P.dg;
  for (let j = 0; j < gh; j++) {
    const py = y0 + 0.25 + 0.5 * (j - 1);
    for (let i = 0; i < gw; i++) {
      const px = x0 + 0.25 + 0.5 * (i - 1);
      const dx = px - cx;
      const dy = py - cy;
      const rho = Math.sqrt(dx * dx + dy * dy);
      let th = Math.atan2(dy, dx);
      if (th < 0) th += TAU;
      const fi = (th / TAU) * NA;
      const ii = Math.min(NA - 1, Math.floor(fi));
      const fr = fi - ii;
      const m = rim[ii] + (rim[ii + 1] - rim[ii]) * fr;
      const s = rho / R;
      const w = s >= 1 ? 1 : 1 - (1 - s * s) * (1 - s * s);
      const rw = R * (1 + m * w);
      const u = rho / rw;
      const g = j * gw + i;
      hg[g] = u < 1 ? Hd * Math.pow(1 - u * u, 0.75) : 0;
      dg[g] = rw - rho;
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let cov = 0;
      for (let sj = 0; sj < 2; sj++) {
        for (let si = 0; si < 2; si++) {
          const i = 2 * (x - x0) + 1 + si;
          const j = 2 * (y - y0) + 1 + sj;
          const g = j * gw + i;
          const al = clamp(dg[g] / 0.7 + 0.5, 0, 1);
          if (al <= 0) continue;
          const hx = hg[g + 1] - hg[g - 1];
          const hy = hg[g + gw] - hg[g - gw];
          const px = x + 0.25 + 0.5 * si;
          const py = y + 0.25 + 0.5 * sj;
          const vx = (px - 32) / CAM;
          const vy = (py - 64) / CAM;
          const vl = 1 / Math.sqrt(vx * vx + vy * vy + 1);
          const dx = vx * vl;
          const dy = vy * vl;
          const dz = -vl;
          const nl = 1 / Math.sqrt(hx * hx + hy * hy + 1);
          const nx = -hx * nl;
          const ny = -hy * nl;
          const nz = nl;
          const dn = 2 * (dx * nx + dy * ny + dz * nz);
          env(dx - dn * nx, dy - dn * ny, dz - dn * nz, P, false);
          sr += al * HG * P.er;
          sg += al * HG * P.eg;
          sb += al * HG * P.eb;
          cov += al;
        }
      }
      if (cov <= 0) continue;
      const o = (y * W + x) * 3;
      const k = 1 - cov / 4;
      out[o] = sr / 4 + out[o] * k;
      out[o + 1] = sg / 4 + out[o + 1] * k;
      out[o + 2] = sb / 4 + out[o + 2] * k;
    }
  }

  const M = P.hm;
  // Away from where the knob opens the tint also grows richer, so the room reads as coloured light, not a filter.
  const sat = 1 + 0.7 * Math.pow(Math.sin(Math.PI * P.hue), 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const r = out[o];
      const g = out[o + 1];
      const b = out[o + 2];
      // The acid takes the room's tint as well.
      let R2 = M[0] * r + M[1] * g + M[2] * b;
      let G2 = M[2] * r + M[0] * g + M[1] * b;
      let B2 = M[1] * r + M[2] * g + M[0] * b;
      const Y = 0.3 * R2 + 0.59 * G2 + 0.11 * B2;
      // Dim warm colours turn brown on the panel, so the dark parts stay closer to grey.
      const sv = 1 + (sat - 1) * smooth(0.12, 0.45, Y);
      R2 = Y + (R2 - Y) * sv;
      G2 = Y + (G2 - Y) * sv;
      B2 = Y + (B2 - Y) * sv;
      display.setPixel(x, y, clamp(Math.round(R2 * 255), 0, 255), clamp(Math.round(G2 * 255), 0, 255), clamp(Math.round(B2 * 255), 0, 255));
    }
  }
}
