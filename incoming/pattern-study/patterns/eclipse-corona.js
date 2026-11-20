// ===== Patternflow pattern =====
// Title:   Eclipse Corona
// Family:  solar
// Idea:    The white-light corona at totality: a black Moon at the middle of the panel with a pearl-white corona of streamers round it, a turning belt of long pointed helmets seen through a 3D current sheet, faint polar plumes, a thin pink rim at the limb and a few red-pink prominence loops that rise and fade out and are replaced elsewhere.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: streamer-belt models of the solar corona (Altschuler and Newkirk, 1969, potential field with a source surface), as seen in white light at total eclipses
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0..4, Activity=-1..1, Exposure=-1..1
//
// Knob 1: Hue. The tint of the corona. Where the knob opens it is a pearl white with a hint of blue-violet at the outer edge; turned away from there it takes a fuller tint round the whole wheel. The inner corona stays near white and the prominences stay pink-red.
// Knob 2: Spin. How fast the streamer belt turns about the line of sight: it stands still at the bottom of the knob, turns once in about 90 seconds where the knob opens, and once in about 20 seconds at the top.
// Knob 3: Activity. The solar cycle. At the bottom a quiet Sun with one thin equatorial belt and long polar plumes and three prominences; in the middle a second tilted sheet; at the top streamers all round, a third sheet, and six prominences.
// Knob 4: Exposure. How long the film is open. Short shows the bright inner corona and the prominences; long brings the outer streamers out to the panel edges and burns the inner corona to white.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;
// The Moon's radius in LEDs, and the Sun's (the unit of distance) a little smaller, so the limb is covered.
const MOON = 11;
const SUN = 10.8;
// The line of sight is cut into this many steps; each step covers an equal angle, as seen from the point's own height above the centre.
const J = 24;
const PHI_MAX = 1.2;
const PROMS = 6;
const RAYS = 5;

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

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function wrap(a) {
  return a - 6.283185307 * Math.round(a / 6.283185307);
}

export function setup(params) {
  params.t = 0;
  params.tau = 0;
  params.spun = 0;
  params.act = 0.5;
  params.expo = 1.6;
  params.tint = new Float32Array(3);
  // Per LED: unit direction from the middle, distance in LEDs and in Sun radii, angle, the radial law, how much of the LED the Moon leaves.
  const N = W * H;
  params.dirx = new Float32Array(N);
  params.diry = new Float32Array(N);
  params.rho = new Float32Array(N);
  params.ang = new Float32Array(N);
  params.law = new Float32Array(N);
  params.cov = new Float32Array(N);
  params.glow = new Float32Array(N);
  params.wi = new Float32Array(N * J);
  // Per step of the line of sight: weight, sine and cosine of the angle off the sky plane, and the cosine squared.
  params.cw = new Float32Array(J);
  params.sj = new Float32Array(J);
  params.cj = new Float32Array(J);
  const dphi = (2 * PHI_MAX) / J;
  let tot = 0;
  for (let j = 0; j < J; j++) {
    const p = -PHI_MAX + (j + 0.5) * dphi;
    params.sj[j] = Math.sin(p);
    params.cj[j] = Math.cos(p);
    params.cw[j] = Math.pow(Math.cos(p), 1.2);
    tot += params.cw[j];
  }
  for (let j = 0; j < J; j++) params.cw[j] /= tot;
  const limb = [];
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - CY;
      const d = Math.sqrt(dx * dx + dy * dy);
      params.dirx[i] = dx / (d || 1);
      params.diry[i] = dy / (d || 1);
      params.rho[i] = d;
      params.ang[i] = Math.atan2(dy, dx);
      const r = Math.max(d / SUN, 1);
      params.law[i] = Math.pow(r, -2.2);
      params.glow[i] = 0.55 * Math.exp(-(r - 1) / 0.3);
      params.cov[i] = smooth(MOON - 0.55, MOON + 0.55, d);
      // The sheet narrows with distance: w = 0.065 + 0.25 / r^2, with r the distance of the step from the centre.
      for (let j = 0; j < J; j++) {
        const rr = r / params.cj[j];
        const w = 0.065 + 0.25 / (rr * rr);
        params.wi[i * J + j] = 1 / (w * w);
      }
      if (d > MOON - 1.5 && d < MOON + 17) limb.push(i);
    }
  params.limb = Int32Array.from(limb);
  params.promA = new Float32Array(N);
  params.chrom = new Float32Array(N);
  // Three current sheets: normal x, y and z, amplitude, and the angle of the normal's sky part.
  params.sh = [0, 1, 2].map(() => ({ nx: 0, ny: 0, nz: 0, amp: 0, phi: 0 }));
  params.rayPos = new Float32Array(RAYS);
  params.rayAmp = new Float32Array(RAYS);
  params.pole = 0;
  params.plume = 0;
  params.halo = 1;
  params.sideC = 0;
  params.sideS = 0;
  params.holeAt = 0;
  params.holeAmp = 0;
  params.proms = [];
  for (let k = 0; k < PROMS; k++) params.proms.push({ a: 0, sh: 4, hh: 5, lean: 0, life: 60, age: 0 });
  for (let k = 0; k < PROMS; k++) {
    spawn(params, k);
    params.proms[k].age = Math.random() * params.proms[k].life;
  }
}

// A new prominence for slot k, as far from the others along the limb as twelve tries find.
function spawn(params, k) {
  const p = params.proms[k];
  let best = 0;
  let far = -1;
  for (let c = 0; c < 12; c++) {
    const a = Math.random() * 6.283185307;
    let near = 9;
    for (let m = 0; m < PROMS; m++) {
      if (m === k) continue;
      near = Math.min(near, Math.abs(wrap(a - params.proms[m].a)));
    }
    if (near > far) {
      far = near;
      best = a;
    }
  }
  p.a = best;
  p.sh = 2.2 + 2.6 * Math.random();
  p.hh = 3 + 4 * Math.random();
  p.lean = (Math.random() - 0.5) * 0.7;
  p.life = 40 + 50 * Math.random();
  p.age = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const spin = Math.pow(clamp(k[1], 0, 4) / 2, 2.1);
  const act = (clamp(k[2], -1, 1) + 1) / 2;
  params.act = act;
  params.expo = 2.2 * Math.pow(2, 1.6 * clamp(k[3], -1, 1));
  // Where the knob opens the tint is only a hint of blue-violet on a pearl white; a little way round the wheel it is a full tint.
  const hue = clamp(k[0], 0, 1);
  const away = Math.min(hue, 1 - hue);
  const wheel = (hue + 0.68) % 1;
  // Yellow-green goes to mud when it is dim, so it keeps less of its saturation.
  const dull = 1 - 0.4 * Math.exp(-((wheel - 0.19) * (wheel - 0.19)) / 0.005);
  hsv(wheel, (0.36 + 0.44 * smooth(0.02, 0.2, away)) * dull, 1, params.tint);

  // The belt's own clock runs at the Spin rate, so at the bottom of the knob it stands still.
  params.tau += dt * spin;
  const tau = params.tau;
  params.spun += (dt * spin * 6.283185307) / 90;
  const sp = params.spun;
  const phi = [
    sp + 0.55 * Math.sin(0.0771 * tau + 0.8) + 0.1 * Math.sin(0.189 * tau),
    -0.63 * sp + 2.1 + 0.3 * Math.sin(0.0533 * tau + 3),
    1.41 * sp + 4 + 0.45 * Math.sin(0.0911 * tau + 1),
  ];
  const theta = [
    1.5 + 0.13 * Math.sin(0.0417 * tau + 1.9) + 0.05 * Math.sin(0.137 * tau + 0.4),
    1.47 + 0.16 * Math.sin(0.0613 * tau + 0.5) + 0.05 * Math.sin(0.153 * tau + 1),
    1.5 + 0.14 * Math.sin(0.0331 * tau + 2.2),
  ];
  // The sheets swell and thin over minutes, each on its own period.
  const amp = [
    3.6 * (0.9 + 0.42 * Math.sin(0.0457 * tau + 1) + 0.15 * Math.sin(0.113 * tau)),
    4 * Math.pow(act, 0.7) * (0.7 + 0.55 * Math.sin(0.0521 * tau + 0.3)),
    3.4 * clamp((act - 0.25) * 1.6, 0, 1) * (0.7 + 0.5 * Math.sin(0.0397 * tau + 2)),
  ];
  for (let s = 0; s < 3; s++) {
    const q = params.sh[s];
    const st = Math.sin(theta[s]);
    q.nx = Math.cos(phi[s]) * st;
    q.ny = Math.sin(phi[s]) * st;
    q.nz = Math.cos(theta[s]);
    q.amp = amp[s];
    q.phi = phi[s];
  }

  // Polar plumes: thin rays about the pole, which is where the main sheet's normal points on the sky.
  params.pole = phi[0] + 0.5 * Math.sin(0.0617 * tau + 2);
  params.halo = 1 + 0.4 * Math.sin(0.0373 * tau + 0.6) + 0.12 * Math.sin(0.1091 * tau);
  // The haze is brighter on one side, and that side wanders round on its own.
  const side = -0.37 * sp + 1.1 + 0.6 * Math.sin(0.0283 * tau + 0.4);
  // A dark sector, thin in the corona, wanders round the limb on its own clock.
  params.holeAt = -0.31 * sp + 2 + 1.2 * Math.sin(0.0199 * tau);
  params.holeAmp = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(0.0273 * tau + 1));
  params.sideC = 0.8 * Math.cos(side);
  params.sideS = 0.8 * Math.sin(side);
  params.plume = 1 - 0.7 * act;
  for (let r = 0; r < RAYS; r++) {
    params.rayPos[r] = (r - (RAYS - 1) / 2) * 0.2 + 0.05 * Math.sin(0.09 * tau + r * 2.1);
    params.rayAmp[r] = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(0.13 * tau + r * 1.7 + 0.5));
  }

  // Prominences live out their lives and are replaced elsewhere.
  for (let m = 0; m < PROMS; m++) {
    const p = params.proms[m];
    p.age += dt;
    if (p.age > p.life) spawn(params, m);
  }

  // The prominences and the rim, drawn once a frame for the LEDs near the limb.
  const { limb, rho, ang, promA, chrom } = params;
  const nProm = 2.8 + 3.2 * act;
  const rimPhase = 0.07 * t;
  for (let li = 0; li < limb.length; li++) {
    const i = limb[li];
    const d = rho[i];
    const b = ang[i];
    promA[i] = 0;
    // The rim: pink glow along the edge, strong on some arcs and gone on others.
    const mod = 0.55 * Math.sin(3 * b + rimPhase + 1) + 0.4 * Math.sin(5 * b - 1.3 * rimPhase + 2) + 0.3 * Math.sin(8 * b + 0.6 * rimPhase);
    const e = (d - MOON - 0.1) / 0.85;
    chrom[i] = (0.22 + 0.78 * smooth(-0.2, 0.7, mod)) * Math.exp(-e * e);
  }
  for (let m = 0; m < PROMS; m++) {
    const p = params.proms[m];
    const weight = clamp(nProm - m, 0, 1);
    if (weight <= 0) continue;
    const u = p.age / p.life;
    const env = smooth(0, 0.18, u) * smooth(1, 0.72, u) * weight;
    const rise = 0.35 + 0.65 * Math.sqrt(u);
    const a = p.sh;
    const hh = p.hh * rise;
    const bb = hh + 0.8;
    for (let li = 0; li < limb.length; li++) {
      const i = limb[li];
      const db = wrap(ang[i] - p.a);
      if (db > 1.1 || db < -1.1) continue;
      const d = rho[i];
      const x = d * Math.sin(db);
      const y = d * Math.cos(db) - MOON + 0.8;
      if (y < 0) continue;
      const xl = x - p.lean * y;
      const f = (xl / a) * (xl / a) + (y / bb) * (y / bb) - 1;
      const gx = (2 * xl) / (a * a);
      const gy = (2 * y) / (bb * bb);
      const dist = f / (Math.sqrt(gx * gx + gy * gy) + 1e-6);
      const line = Math.exp((-dist * dist) / 1.5);
      const fill = dist < 0 ? 0.22 * clamp(-dist / 2.5, 0, 1) : 0;
      promA[i] += (line + fill) * env;
    }
  }
}

export function draw(display, params) {
  const { dirx, diry, rho, ang, law, glow, cov, wi, cw, sj, cj, sh, promA, chrom, tint, rayPos, rayAmp } = params;
  const act = params.act;
  const expo = params.expo;
  const base = (0.03 + 0.2 * Math.pow(act, 1.2)) * params.halo;
  const tau = params.tau;
  // The belts also fatten and pinch over a couple of minutes.
  const wide = (0.85 + 0.7 * act) * (1 + 0.28 * Math.sin(0.0337 * tau + 1.4) + 0.1 * Math.sin(0.0921 * tau));
  const sc = 1 / (wide * wide);
  const s0 = sh[0];
  const s1 = sh[1];
  const s2 = sh[2];
  const use1 = s1.amp > 0.01;
  const use2 = s2.amp > 0.01;
  const hasPlume = params.plume > 0.01;
  const poleA = params.pole;
  const pm = params.plume;
  const holeAt = params.holeAt;
  const holeAmp = params.holeAmp;
  const sideC = params.sideC;
  const sideS = params.sideS;
  const wa0 = 0.14 * (0.9 + 0.6 * Math.sin(0.0431 * tau + 1.3));
  const wa1 = 0.14 * (0.9 + 0.6 * Math.sin(0.0577 * tau + 0.2));
  const wa2 = 0.14 * (0.9 + 0.6 * Math.sin(0.0299 * tau + 2.6));
  for (let i = 0, y = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const dx = dirx[i];
      const dy = diry[i];
      const an = ang[i];
      const w0 = wa0 * Math.sin(3 * (an - s0.phi) + 0.11 * tau);
      const a0 = s0.nx * dx + s0.ny * dy + w0;
      let a1 = 0;
      let a2 = 0;
      if (use1) a1 = s1.nx * dx + s1.ny * dy + wa1 * Math.sin(3 * (an - s1.phi) + 0.13 * tau + 1);
      if (use2) a2 = s2.nx * dx + s2.ny * dy + wa2 * Math.sin(3 * (an - s2.phi) + 0.09 * tau + 2);
      const hz = base * (1 + sideC * dx + sideS * dy);
      const o = i * J;
      let sum = 0;
      for (let j = 0; j < J; j++) {
        const c = cj[j];
        const sn = sj[j];
        const wj = wi[o + j] * sc;
        const e0 = a0 * c + s0.nz * sn;
        const g0 = 1 / (1 + e0 * e0 * wj);
        let m = hz + s0.amp * g0 * g0;
        if (use1) {
          const e1 = a1 * c + s1.nz * sn;
          const g1 = 1 / (1 + e1 * e1 * wj);
          m += s1.amp * g1 * g1;
        }
        if (use2) {
          const e2 = a2 * c + s2.nz * sn;
          const g2 = 1 / (1 + e2 * e2 * wj);
          m += s2.amp * g2 * g2;
        }
        sum += cw[j] * m;
      }
      const hd = wrap(an - holeAt);
      let I = law[i] * sum * (1 - holeAmp * Math.exp(-(hd * hd) / 0.4)) + glow[i];
      // Polar plumes: narrow rays in a fan about the pole, fainter and wider near the disc.
      if (hasPlume) {
        let psi = wrap(an - poleA);
        if (psi > 1.5708) psi -= 3.14159265;
        else if (psi < -1.5708) psi += 3.14159265;
        if (psi < 0.75 && psi > -0.75) {
          const sg = Math.max(0.05, 1.8 / rho[i]);
          let r = 0;
          for (let k = 0; k < RAYS; k++) {
            const e = (psi - rayPos[k]) / sg;
            r += rayAmp[k] * Math.exp(-e * e);
          }
          const cone = Math.exp(-(psi * psi) / 0.22);
          I += law[i] * 0.45 * pm * cone * Math.min(r, 1.2);
        }
      }
      // Tone: a soft curve that never clips hard.
      const xx = I * expo;
      const v = 1 - Math.exp(-Math.pow(xx, 0.5));
      // Pearl white where it is bright, tinted where it is faint.
      const k = (0.08 + 0.7 * Math.pow(1 - v, 1.2)) * smooth(0.04, 0.4, v);
      let r = (1 + (tint[0] - 1) * k) * v;
      let g = (1 + (tint[1] - 1) * k) * v;
      let b = (1 + (tint[2] - 1) * k) * v;
      const ch = chrom[i];
      const pa = promA[i];
      if (ch > 0.001) {
        const al = 0.5 * ch;
        r += (0.98 - r) * al;
        g += (0.36 - g) * al;
        b += (0.55 - b) * al;
      }
      if (pa > 0.001) {
        const al = Math.min(1, pa);
        const hot = Math.min(1, pa);
        r += (0.98 - r) * al;
        g += (0.26 + 0.3 * hot - g) * al;
        b += (0.4 + 0.3 * hot - b) * al;
      }
      const cv = cov[i] * 255;
      display.setPixel(x, y, clamp(r * cv, 0, 255), clamp(g * cv, 0, 255), clamp(b * cv, 0, 255));
    }
  }
}
