// ===== Patternflow pattern =====
// Title:   Star Trails
// Family:  celestial
// Idea:    A camera on a tripod holds its shutter open while the sky turns: every star draws an arc around the pole above a dark ridge and a lit tent.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: star-trail photographs, the long exposures that show the sky turning about the celestial pole
// Round:   12
// ===============================
// @matrix 64x128
// @knobs Facing=-1..1, Speed=0.2..3, Latitude=-1..1, Exposure=0..1
//
// Knob 1: Facing. Where the camera points: north in the middle, where the trails ring the pole; turned either way it swings round through east or west to the south, where the arcs rise, cross the meridian and set.
// Knob 2: Speed. How fast the sky turns: at the bottom of the range the stars hardly move, at the top a star near the horizon crosses the frame in under a minute.
// Knob 3: Latitude. Where the tripod stands: the middle is 37.5 degrees north; down to the equator the pole sinks to the horizon and the stars rise straight up, up to the North Pole the pole climbs overhead and the trails run level with the ground.
// Knob 4: Exposure. How long the shutter has been open: from short strokes to nearly whole circles.
// Buttons: K1 tap sends a meteor across the frame; it stays in the picture as long as the trails do.

const W = 64;
const H = 128;
const N = W * H;
// The lens. One unit of tan(angle) off the axis is S LEDs, so the frame is
// 28 degrees either side and 47 up and down.
const S = 60;
const CX = W / 2;
const CY = H / 2;
const HORIZON = 112;
// The camera tilts up so the horizon sits HORIZON rows down.
const TILT = Math.atan((HORIZON - CY) / S);
const STARS = 460;
const DEG = Math.PI / 180;
// Star colours by spectral class, from blue-white to red, and how often each
// turns up among the stars bright enough to trail.
const CLASSES = [
  [0.42, 0.6, 1.0, 0.18],
  [0.82, 0.88, 1.0, 0.22],
  [1.0, 0.92, 0.72, 0.18],
  [1.0, 0.76, 0.4, 0.18],
  [1.0, 0.56, 0.22, 0.16],
  [1.0, 0.36, 0.18, 0.08],
];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The ridge's height above the horizon, in degrees, round the whole compass.
function ridge(az) {
  const a = az / DEG;
  return (
    2.2 +
    1.6 * Math.sin(az * 2 + 0.7) +
    1.1 * Math.sin(az * 5 + 2.1) +
    0.5 * Math.sin(az * 11 + 0.3) +
    (a > 300 && a < 345 ? 3.5 * Math.sin(((a - 300) / 45) * Math.PI) : 0)
  );
}

// A pine's silhouette from its foot (bx, by) up to its tip at row ty, in
// tiers that each flare out at the bottom.
function pine(ground, bx, by, ty, tiers) {
  const height = by - ty;
  const reach = Math.max(1.2, height * 0.26);
  for (let y = Math.floor(ty); y <= Math.ceil(by); y++) {
    if (y < 0 || y >= H) continue;
    const k = (y - ty) / height;
    let half = 0.5;
    if (k < 0.88) {
      const crown = k / 0.88;
      const tier = (crown * tiers) % 1;
      half = Math.max(0.5, (0.2 + 0.8 * crown) * reach * (0.5 + 0.5 * tier));
    }
    for (let x = Math.round(bx - half); x <= Math.round(bx + half - 0.01); x++) if (x >= 0 && x < W) ground[y * W + x] = 1;
  }
}

export function setup(params) {
  const P = params;
  // Stars spread evenly over the sphere: declination and right ascension.
  P.sinDec = new Float32Array(STARS);
  P.cosDec = new Float32Array(STARS);
  P.ra = new Float32Array(STARS);
  P.bright = new Float32Array(STARS);
  P.col = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    let sd = hash(i, 1) * 2 - 1;
    let ra = hash(i, 2) * Math.PI * 2;
    if (i === 0) {
      // Polaris, three quarters of a degree off the pole.
      sd = Math.sin(89.26 * DEG);
      ra = 0.66;
    }
    P.sinDec[i] = sd;
    P.cosDec[i] = Math.sqrt(1 - sd * sd);
    P.ra[i] = ra;
    const m = hash(i, 3);
    P.bright[i] = i === 0 ? 0.95 : 0.2 + 0.8 * m * m * m * m;
    let pick = hash(i, 4);
    let c = CLASSES[0];
    for (const k of CLASSES) {
      c = k;
      pick -= k[3];
      if (pick < 0) break;
    }
    if (i === 0) c = CLASSES[2];
    P.col[i * 3] = c[0];
    P.col[i * 3 + 1] = c[1];
    P.col[i * 3 + 2] = c[2];
  }
  P.acc = new Float32Array(N * 3);
  P.sky = new Float32Array(N * 3);
  P.ground = new Uint8Array(N);
  P.lastFacing = NaN;
  P.clock = 0;
  P.turn = 0.4;
  P.meteors = [];
  P.nextMeteor = 3;
  P.tapCount = 0;
}

// The camera's three axes in north, east, up.
function camera(P, facing) {
  const az = facing;
  const ce = Math.cos(TILT);
  const se = Math.sin(TILT);
  P.f = [ce * Math.cos(az), ce * Math.sin(az), se];
  P.r = [-Math.sin(az), Math.cos(az), 0];
  P.u = [-se * Math.cos(az), -se * Math.sin(az), ce];
}

// A direction in north, east, up to a spot on the panel, or false behind the lens.
function project(P, n, e, up, out) {
  const f = P.f;
  const r = P.r;
  const u = P.u;
  const z = n * f[0] + e * f[1] + up * f[2];
  if (z < 0.2) return false;
  out[0] = CX + (S * (n * r[0] + e * r[1])) / z;
  out[1] = CY - (S * (n * u[0] + e * u[1] + up * u[2])) / z;
  return true;
}

// The landscape and the sky behind the stars; they change only when the
// camera turns.
function buildBackdrop(P, facing) {
  camera(P, facing);
  const sky = P.sky;
  const ground = P.ground;
  ground.fill(0);
  const f = P.f;
  const r = P.r;
  const u = P.u;
  // The ridge top for each column.
  const top = new Float32Array(W);
  const pt = [0, 0];
  for (let x = 0; x < W; x++) {
    const px = (x + 0.5 - CX) / S;
    const py = -(HORIZON - CY) / S;
    const n = f[0] + r[0] * px + u[0] * py;
    const e = f[1] + r[1] * px + u[1] * py;
    let az = Math.atan2(e, n);
    if (az < 0) az += Math.PI * 2;
    const h = ridge(az) * DEG;
    const len = Math.hypot(n, e);
    project(P, (n / len) * Math.cos(h), (e / len) * Math.cos(h), Math.sin(h), pt);
    top[x] = pt[1];
  }
  // Pines: a row of small ones along the ridge, and three tall ones on the
  // near ground. Each stands at its own bearing, so they slide past as the
  // camera turns.
  for (let t = 0; t < 34; t++) {
    const near = t < 3;
    const az = near ? [-17, 13, 158][t] * DEG : hash(t, 21) * Math.PI * 2;
    const tall = (near ? 13 + 7 * hash(t, 22) : 2 + 5 * hash(t, 22)) * DEG;
    const base = near ? -4.5 * DEG : ridge(az) * DEG - 0.8 * DEG;
    if (!project(P, Math.cos(az) * Math.cos(base), Math.sin(az) * Math.cos(base), Math.sin(base), pt)) continue;
    const bx = pt[0];
    const by = pt[1];
    project(P, Math.cos(az) * Math.cos(base + tall), Math.sin(az) * Math.cos(base + tall), Math.sin(base + tall), pt);
    pine(ground, bx, by, pt[1], near ? 4 : 3);
  }
  for (let x = 0; x < W; x++) for (let y = Math.max(0, Math.round(top[x])); y < H; y++) ground[y * W + x] = 1;
  // The tent, pitched on the near ground a little west of north.
  P.tent = null;
  const taz = -6 * DEG;
  const talt = -3.6 * DEG;
  if (project(P, Math.cos(taz) * Math.cos(talt), Math.sin(taz) * Math.cos(talt), Math.sin(talt), pt)) P.tent = [pt[0], pt[1]];

  // Sky: deep blue overhead, paler at the horizon, and the glow of a town
  // far off to the east-south-east.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5 - CX) / S;
      const py = (CY - y - 0.5) / S;
      const n = f[0] + r[0] * px + u[0] * py;
      const e = f[1] + r[1] * px + u[1] * py;
      const up = f[2] + u[2] * py;
      const len = Math.hypot(n, e, up);
      const alt = Math.asin(up / len);
      const az = Math.atan2(e, n);
      const lowness = Math.exp(-Math.max(0, alt) / (14 * DEG));
      const townAz = Math.cos(az - 110 * DEG);
      const town = Math.max(0, townAz) ** 6 * Math.exp(-Math.max(0, alt) / (9 * DEG));
      const o = (y * W + x) * 3;
      sky[o] = 0.006 + 0.03 * lowness + 0.2 * town;
      sky[o + 1] = 0.01 + 0.05 * lowness + 0.1 * town;
      sky[o + 2] = 0.04 + 0.09 * lowness + 0.03 * town;
    }
  }
  P.lastFacing = facing;
}

function splat(acc, x, y, w, r, g, b) {
  const x0 = Math.floor(x - 0.5);
  const y0 = Math.floor(y - 0.5);
  const fx = x - 0.5 - x0;
  const fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const wy = j ? fy : 1 - fy;
    for (let i = 0; i < 2; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const k = w * wy * (i ? fx : 1 - fx);
      const o = (yy * W + xx) * 3;
      acc[o] += k * r;
      acc[o + 1] += k * g;
      acc[o + 2] += k * b;
    }
  }
}

// A meteor starts somewhere in the upper sky and falls 20 to 55 degrees off
// level, to the left or the right.
function newMeteor(P, bright) {
  const s = P.tapCount++ * 7 + 101;
  const ang = (20 + 35 * hash(s, 3)) * DEG;
  const side = hash(s, 6) < 0.5 ? 1 : -1;
  P.meteors.push({
    x0: side > 0 ? 4 + hash(s, 1) * 30 : W - 4 - hash(s, 1) * 30,
    y0: 6 + hash(s, 2) * 56,
    dx: Math.cos(ang) * side,
    dy: Math.sin(ang),
    len: 30 + 26 * hash(s, 5),
    age: 0,
    bright,
  });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  // North sits at the middle of the knob; either end is due south.
  const facing = k[0] * Math.PI;
  const v = k[2];
  const lat = (v < 0 ? 37.5 * (1 + v) : 37.5 + 52.5 * v) * DEG;
  if (facing !== P.lastFacing) buildBackdrop(P, facing);
  P.lat = lat;
  // The lantern in the tent wavers a little.
  P.clock += dt;
  const c = P.clock;
  P.lamp = 0.86 + 0.06 * Math.sin(c * 2.3) + 0.05 * Math.sin(c * 5.1 + 1) + 0.03 * Math.sin(c * 11.7 + 2);
  P.omega = k[1] * 2.6 * DEG;
  P.turn += dt * P.omega;
  P.span = (80 + 260 * k[3]) * DEG;
  // How long the shutter has been open, in seconds, for anything that is
  // not a star.
  P.open = P.span / Math.max(P.omega, 1e-4);
  if (input.btnPressed && input.btnPressed[0]) newMeteor(P, 1);
  P.nextMeteor -= dt;
  if (P.nextMeteor <= 0) {
    newMeteor(P, 0.7);
    P.nextMeteor = 9 + 14 * hash(P.tapCount, 9);
  }
  for (const m of P.meteors) m.age += dt;
  P.meteors = P.meteors.filter((m) => m.age < Math.min(P.open, 60));
}

export function draw(display, params) {
  const P = params;
  const acc = P.acc;
  acc.fill(0);
  const sphi = Math.sin(P.lat);
  const cphi = Math.cos(P.lat);
  const span = P.span;
  const f = P.f;
  const pt = [0, 0];
  const prev = [0, 0];
  // A coarse pass at 6 degrees finds the stretches of each trail inside the
  // frame; only those are drawn finely.
  const coarse = 6 * DEG;
  for (let i = 0; i < STARS; i++) {
    const sd = P.sinDec[i];
    const cd = P.cosDec[i];
    const head = P.turn - P.ra[i];
    const tail = head - span;
    const steps = Math.ceil(span / coarse);
    const bright = P.bright[i];
    const cr = P.col[i * 3];
    const cg = P.col[i * 3 + 1];
    const cb = P.col[i * 3 + 2];
    // Fine step: about two thirds of an LED along the trail.
    const fine = Math.min(coarse, 0.65 / (S * Math.max(cd, 0.004) * 1.3));
    for (let s = 0; s < steps; s++) {
      const a0 = tail + s * coarse;
      const a1 = Math.min(head, a0 + coarse);
      // Is either end of this stretch in or near the frame?
      let near = false;
      for (const a of [a0, a1]) {
        const ch = Math.cos(a);
        const up = sphi * sd + cphi * cd * ch;
        const n = cphi * sd - sphi * cd * ch;
        const e = -cd * Math.sin(a);
        const z = n * f[0] + e * f[1] + up * f[2];
        if (z < 0.3 || up < -0.08) continue;
        if (project(P, n, e, up, pt) && pt[0] > -12 && pt[0] < W + 12 && pt[1] > -12 && pt[1] < HORIZON + 6) near = true;
      }
      if (!near) continue;
      const count = Math.max(1, Math.ceil((a1 - a0) / fine));
      const da = (a1 - a0) / count;
      let ch = Math.cos(a0);
      let sh = Math.sin(a0);
      const cd1 = Math.cos(da);
      const sd1 = Math.sin(da);
      let have = false;
      for (let q = 0; q <= count; q++) {
        const up = sphi * sd + cphi * cd * ch;
        const n = cphi * sd - sphi * cd * ch;
        const e = -cd * sh;
        const a = a0 + q * da;
        if (up > -0.02 && project(P, n, e, up, pt)) {
          if (have) {
            const len = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
            // The trail fades in over its oldest sixth and is brightest at the head.
            const age = (a - tail) / span;
            const w = bright * len * Math.min(1, age * 6) * (0.75 + 0.25 * age);
            if (len < 4 && pt[0] > -2 && pt[0] < W + 2 && pt[1] > -2 && pt[1] < H + 2) splat(acc, pt[0], pt[1], w, cr, cg, cb);
          }
          prev[0] = pt[0];
          prev[1] = pt[1];
          have = true;
        } else have = false;
        const c2 = ch * cd1 - sh * sd1;
        sh = sh * cd1 + ch * sd1;
        ch = c2;
      }
      // The star itself, where it is now.
      if (a1 === head && have) splat(acc, prev[0], prev[1], bright * 0.7, cr, cg, cb);
    }
  }

  // Meteors: they streak in over a third of a second and stay as long as the
  // trails remember.
  for (const m of P.meteors) {
    const grow = Math.min(1, m.age / 0.35);
    const fade = 1 - m.age / Math.min(P.open, 60);
    const len = m.len * grow;
    for (let d = 0; d < len; d += 0.5) {
      const t = d / m.len;
      const x = m.x0 + m.dx * d;
      const y = m.y0 + m.dy * d;
      if (y > HORIZON) break;
      // Greenish at the head, warm in the wake.
      const w = 0.5 * m.bright * fade * Math.sin(Math.PI * Math.min(1, t * 1.1));
      splat(acc, x, y, w, 0.55 + 0.45 * (1 - t), 1.0, 0.55 + 0.35 * t);
    }
  }

  const sky = P.sky;
  const ground = P.ground;
  const tent = P.tent;
  const lamp = P.lamp;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      let r;
      let g;
      let b;
      if (ground[p]) {
        r = 0.004;
        g = 0.005;
        b = 0.012;
      } else {
        r = sky[o] + acc[o];
        g = sky[o + 1] + acc[o + 1];
        b = sky[o + 2] + acc[o + 2];
      }
      if (tent) {
        const dx = x + 0.5 - tent[0];
        const dy = y + 0.5 - tent[1];
        // The tent: a lit orange triangle six LEDs high, and its glow on the grass.
        if (dy <= 0 && dy > -6 && Math.abs(dx) < (dy + 6) * 0.8) {
          const inner = 1 - Math.abs(dx) / ((dy + 6) * 0.8 + 0.01);
          r = (0.85 + 0.15 * inner) * lamp;
          g = (0.42 + 0.2 * inner) * lamp;
          b = 0.12 * lamp;
        } else if (ground[p]) {
          const glow = Math.exp(-(dx * dx * 0.04 + dy * dy * 0.18)) * 0.22 * lamp;
          r += glow;
          g += glow * 0.45;
          b += glow * 0.12;
        }
      }
      // A soft shoulder instead of a hard clip where trails pile up at the pole.
      display.setPixel(x, y, 255 * (1 - Math.exp(-r * 1.6)) * 1.25, 255 * (1 - Math.exp(-g * 1.6)) * 1.25, 255 * (1 - Math.exp(-b * 1.6)) * 1.25);
    }
  }
}
