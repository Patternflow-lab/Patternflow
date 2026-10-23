// ===== Patternflow pattern =====
// Title:   Jacob's Ladder
// Family:  light
// Idea:    An arc strikes where two rods stand closest, rides its own hot air up the widening V until it is too long to hold, and breaks at the tips while the next one strikes below.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the climbing arc of the high-voltage demonstration called Jacob's ladder
// Round:   6
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Power=0.3..3, Spread=0..1, Exposure=0..1
//
// Knob 1: Hue. The colour of the gas the arc burns in, starting from the violet of an arc in air.
// Knob 2: Power. How hard the transformer drives the arc: weak, it climbs slowly and breaks halfway up; strong, it races to the tips, writhes, throws sparks and strikes again before the last one is gone.
// Knob 3: Spread. How far apart the rod tips stand, from a narrow V to horns that flare out to the edges of the panel; a wide V breaks a weak arc lower down.
// Knob 4: Exposure. How long the panel keeps each arc after it has moved on, like a camera left open; turned up, the arcs it leaves stack into the rungs of a ladder.
// Buttons: K1 tap strikes a new arc now.

const W = 64;
const H = 128;
const N = W * H;
const CX = 32;
// Rows, top down: the rod tips, the throat where the rods come closest and
// every arc strikes, the tops of the two insulators, the lid of the box.
const TIP = 8;
const THROAT = 94;
const POST = 104;
const BOX = 116;
// Half the gap between the rods at the throat and where they leave the posts.
const THROAT_GAP = 2.2;
const POST_GAP = 9.5;
const ARCS = 3;
const PTS = 72;
const EMBERS = 48;
// The arc throbs at this rate. A camera left open keeps the bright moments
// and loses the dim ones, so the long exposure lays the arc down in rungs.
const HUM = 10;
// The arc lights the air around it. That wide glow is worked out on a grid
// of 4 LED cells and spread across the cells between.
const CELL = 4;
const GW = W / CELL + 1;
const GH = H / CELL + 1;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function hash2(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise, -1..1.
function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

// Half the gap between the rods at row y, read from the table build() fills.
function gapAt(P, y) {
  if (y <= TIP) return P.gap[TIP];
  if (y >= POST) return POST_GAP;
  const i = Math.floor(y);
  const f = y - i;
  return P.gap[i] + (P.gap[i + 1] - P.gap[i]) * f;
}

// The rods, the posts and the box, drawn once for a spread. Above the throat
// the rods open from a straight V to horns: the wider the spread, the longer
// they stay close before they flare.
function build(P, spread) {
  P.spread = spread;
  const top = 15 + 16 * spread;
  const bend = 1.1 + 0.6 * spread;
  for (let y = 0; y <= H; y++) {
    if (y <= THROAT) {
      const u = Math.min(1, (THROAT - y) / (THROAT - TIP));
      P.gap[y] = THROAT_GAP + (top - THROAT_GAP) * Math.pow(u, bend);
    } else {
      const t = Math.min(1, (y - THROAT) / (POST - THROAT));
      P.gap[y] = THROAT_GAP + (POST_GAP - THROAT_GAP) * t * t;
    }
  }
  const rod = P.rod;
  rod.fill(0);
  // Each rod is stamped every quarter row, so a pixel keeps how close the
  // rod's centre line passed it: a one-LED wire, shared between two LEDs
  // where it runs between them.
  for (let y = TIP; y <= POST; y += 0.25) {
    const g = gapAt(P, y);
    for (let side = -1; side <= 1; side += 2) {
      const x = CX + side * g;
      const x0 = Math.floor(x) - 1;
      const y0 = Math.floor(y) - 1;
      for (let py = y0; py <= y0 + 2; py++) {
        if (py < 0 || py >= H) continue;
        for (let px = x0; px <= x0 + 2; px++) {
          if (px < 0 || px >= W) continue;
          const d = Math.hypot(px + 0.5 - x, py + 0.5 - y);
          const c = Math.min(1, Math.max(0, 1.05 - d));
          const i = py * W + px;
          if (c > rod[i]) rod[i] = c;
        }
      }
    }
  }
  // A round knob on each tip.
  for (let side = -1; side <= 1; side += 2) {
    const x = CX + side * P.gap[TIP];
    for (let py = TIP - 3; py <= TIP + 1; py++) {
      for (let px = Math.floor(x) - 2; px <= Math.floor(x) + 2; px++) {
        if (px < 0 || px >= W) continue;
        const d = Math.hypot(px + 0.5 - x, py + 0.5 - (TIP - 0.6));
        const c = Math.min(1, Math.max(0, 1.7 - d));
        const i = py * W + px;
        if (c > rod[i]) rod[i] = c;
      }
    }
  }

  const st = P.stat;
  st.fill(0);
  for (let i = 0; i < N; i++) {
    const c = rod[i];
    if (c <= 0) continue;
    const x = i % W;
    // Steel, a touch lighter on the face toward the middle.
    const face = x < CX ? 1.08 : 0.94;
    st[i * 3] = 98 * c * face;
    st[i * 3 + 1] = 102 * c * face;
    st[i * 3 + 2] = 116 * c * face;
  }
  // Two glazed posts with sheds, lit from the left.
  for (let y = POST; y < BOX; y++) {
    const wide = (y - POST) % 3 !== 2;
    const half = wide ? 3 : 2;
    for (let side = -1; side <= 1; side += 2) {
      const cx = CX + side * POST_GAP;
      for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
        const u = (x + 0.5 - (cx - half)) / (2 * half);
        const shade = (wide ? 1 : 0.68) * (1.15 - 0.6 * u);
        const o = (y * W + x) * 3;
        st[o] = 176 * shade;
        st[o + 1] = 166 * shade;
        st[o + 2] = 148 * shade;
      }
    }
  }
  // The transformer box: a light lid, a dark body with vent slots.
  for (let y = BOX; y < H; y++) {
    for (let x = 3; x < W - 3; x++) {
      if (y === BOX && (x === 3 || x === W - 4)) continue;
      const o = (y * W + x) * 3;
      let r = 54;
      let g = 52;
      let b = 60;
      if (y === BOX) {
        r = 104;
        g = 102;
        b = 112;
      } else if (y === BOX + 1) {
        r = 70;
        g = 68;
        b = 76;
      } else if (y >= BOX + 4 && y <= BOX + 9 && (y - BOX) % 2 === 0 && x >= 16 && x < W - 16) {
        r = 18;
        g = 18;
        b = 21;
      }
      st[o] = r;
      st[o + 1] = g;
      st[o + 2] = b;
    }
  }
}

export function setup(params) {
  const P = params;
  P.gap = new Float32Array(H + 1);
  P.rod = new Float32Array(N);
  P.stat = new Float32Array(N * 3);
  P.spread = -1;
  P.alive = new Uint8Array(ARCS);
  P.age = new Float32Array(ARCS);
  P.root = new Float32Array(ARCS);
  P.life = new Float32Array(ARCS);
  P.seed = new Float32Array(ARCS);
  P.turb = new Float32Array(ARCS);
  P.len = new Float32Array(ARCS);
  P.speed = new Float32Array(ARCS);
  P.ends = new Float32Array(ARCS * 4);
  P.px = new Float32Array(ARCS * PTS);
  P.py = new Float32Array(ARCS * PTS);
  P.pn = new Uint8Array(ARCS);
  P.ex = new Float32Array(EMBERS);
  P.ey = new Float32Array(EMBERS);
  P.evx = new Float32Array(EMBERS);
  P.evy = new Float32Array(EMBERS);
  P.elife = new Float32Array(EMBERS);
  P.emax = new Float32Array(EMBERS);
  P.ebounce = new Uint8Array(EMBERS);
  P.core = new Float32Array(N);
  P.glow = new Float32Array(N);
  P.trail = new Float32Array(N);
  P.warm = new Float32Array(N);
  P.dist = new Float32Array(N).fill(1e9);
  P.air = new Float32Array(GW * GH);
  P.airTrail = new Float32Array(GW * GH);
  P.out = new Float32Array(N * 3);
  P.col = new Float32Array(12);
  P.t = 0;
  P.dt = 1 / 30;
  P.flash = 0;
  P.cool = 0;
  P.power = 2;
  P.hue = 0;
  P.exposure = 0.06;
}

function strike(P) {
  let a = -1;
  for (let i = 0; i < ARCS; i++) if (P.alive[i] === 0) a = i;
  if (a < 0) {
    // Every slot is busy: the oldest arc gives way.
    a = 0;
    for (let i = 1; i < ARCS; i++) if (P.age[i] > P.age[a]) a = i;
  }
  P.alive[a] = 1;
  P.age[a] = 0;
  P.root[a] = THROAT - 0.3 + (Math.random() - 0.5) * 1.2;
  P.life[a] = 1;
  P.seed[a] = Math.floor(Math.random() * 997);
  P.turb[a] = 0;
  P.len[a] = 0;
  P.flash = 1;
  P.cool = 0;
}

// The arc's points for this frame: a chord between the two roots, bowed up
// in the middle, where hot air rises fastest, and bent by turbulence that
// grows with the arc's length. The roots sit on the inner face of each rod.
function shape(P, a) {
  const age = P.age[a];
  const live = P.alive[a] === 1;
  const seed = P.seed[a];
  const yl = P.root[a] + 0.9 * noise2(age * 2.7, seed);
  const yr = P.root[a] + 0.9 * noise2(age * 2.7, seed + 17);
  const xl = CX - gapAt(P, yl) + 0.7;
  const xr = CX + gapAt(P, yr) - 0.7;
  P.ends[a * 4] = xl;
  P.ends[a * 4 + 1] = yl;
  P.ends[a * 4 + 2] = xr;
  P.ends[a * 4 + 3] = yr;
  const dx = xr - xl;
  const dy = yr - yl;
  const chord = Math.max(0.5, Math.hypot(dx, dy));
  const tx = dx / chord;
  const ty = dy / chord;
  // The normal that points up the panel.
  const nx = ty;
  const ny = -tx;
  const power = P.power;
  let bow = chord * (0.1 + 0.05 * power) * (1 - Math.exp(-age / 0.3));
  if (!live) bow += (1 - P.life[a]) * 4;
  const amp = (0.4 + 0.09 * chord) * (0.6 + 0.25 * power);
  const turb = P.turb[a];
  const jit = 0.25 * (0.5 + 0.3 * power);
  const n = Math.max(6, Math.min(PTS, Math.round(chord / 1.1) + 4));
  P.pn[a] = n;
  const o = a * PTS;
  let len = 0;
  let lx = 0;
  let ly = 0;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const e = Math.sin(Math.PI * s);
    const bx = xl + dx * s;
    const by = yl + dy * s;
    const lift = bow * 4 * s * (1 - s);
    const bend =
      amp *
      Math.pow(e, 0.7) *
      (noise2(s * 2.6, turb + seed * 7.3) + 0.45 * noise2(s * 6.1 + 9, turb * 1.7 + seed) + 0.2 * noise2(s * 13 + 21, turb * 3.1 + seed));
    const slide = 0.4 * amp * e * noise2(s * 2 + 40, turb * 0.8 + seed * 3.1);
    const j = (Math.random() - 0.5) * 2 * jit * e;
    let x = bx + nx * (lift + bend + j) + tx * slide;
    const y = by + ny * (lift + bend + j) + ty * slide;
    if (live) {
      const g = gapAt(P, y) - 0.5;
      if (x < CX - g) x = CX - g;
      else if (x > CX + g) x = CX + g;
    }
    P.px[o + i] = x;
    P.py[o + i] = y;
    if (i > 0) len += Math.hypot(x - lx, y - ly);
    lx = x;
    ly = y;
  }
  P.len[a] = len;
}

function throwEmber(P, x, y, side) {
  for (let i = 0; i < EMBERS; i++) {
    if (P.elife[i] > 0) continue;
    P.ex[i] = x;
    P.ey[i] = y;
    P.evx[i] = side * (5 + 18 * Math.random());
    P.evy[i] = -(8 + 26 * Math.random());
    P.emax[i] = 0.7 + 0.9 * Math.random();
    P.elife[i] = P.emax[i];
    P.ebounce[i] = 0;
    return;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  P.hue = k[0];
  const power = Math.max(0.3, Math.min(3, k[1]));
  P.power = power;
  const spread = Math.max(0, Math.min(1, k[2]));
  P.exposure = Math.max(0, Math.min(1, k[3]));
  if (Math.abs(spread - P.spread) > 1e-4) build(P, spread);

  P.t += dt;
  P.dt = dt;
  P.cool += dt;
  P.flash *= Math.exp(-dt / 0.07);

  const vmax = 25 + 32 * power;
  const reach = 20 + 15 * power;
  for (let a = 0; a < ARCS; a++) {
    if (P.alive[a] === 0) continue;
    P.age[a] += dt;
    const v = vmax * (0.25 + 0.75 * (1 - Math.exp(-P.age[a] / 0.22)));
    P.speed[a] = v;
    if (P.alive[a] === 1) {
      P.root[a] -= v * dt;
      P.turb[a] += dt * (1.2 + 0.5 * power);
    } else {
      // Broken: what is left of the arc floats up off the tips and goes out.
      P.root[a] -= v * 0.6 * dt;
      P.turb[a] += dt * 0.8;
      P.life[a] -= dt / 0.16;
      if (P.life[a] <= 0) {
        P.alive[a] = 0;
        continue;
      }
    }
    shape(P, a);
    if (P.alive[a] === 1 && (P.root[a] <= TIP + 1 || P.len[a] > reach)) P.alive[a] = 2;
  }

  // The next arc strikes once the throat is clear for long enough. The
  // throat also breaks down again while the last arc is still climbing: when
  // that arc is high, which comes sooner the harder it is pushed, or when it
  // has stretched long, which comes sooner in a wide V.
  let live = 0;
  let youngest = -1;
  for (let a = 0; a < ARCS; a++) {
    if (P.alive[a] !== 1) continue;
    live++;
    if (youngest < 0 || P.age[a] < P.age[youngest]) youngest = a;
  }
  const rest = 0.05 + 0.25 / power;
  const again = 0.95 - 0.25 * ((power - 0.3) / 2.7);
  if (live === 0) {
    if (P.cool > rest) strike(P);
  } else if (live < (power > 2.2 ? 3 : 2) && P.cool > 0.1) {
    const climbed = (THROAT - P.root[youngest]) / (THROAT - TIP);
    if (climbed > again || P.len[youngest] > 0.75 * reach) strike(P);
  }
  if (input.btnPressed && input.btnPressed[0]) strike(P);

  // Hot metal leaves the roots as sparks, thrown off the rod and falling.
  for (let a = 0; a < ARCS; a++) {
    if (P.alive[a] !== 1) continue;
    const rate = 0.4 * power * power;
    if (Math.random() < rate * dt) throwEmber(P, P.ends[a * 4], P.ends[a * 4 + 1], -1);
    if (Math.random() < rate * dt) throwEmber(P, P.ends[a * 4 + 2], P.ends[a * 4 + 3], 1);
  }
  for (let i = 0; i < EMBERS; i++) {
    if (P.elife[i] <= 0) continue;
    P.elife[i] -= dt;
    P.evy[i] += 70 * dt;
    P.ex[i] += P.evx[i] * dt;
    P.ey[i] += P.evy[i] * dt;
    if (P.ey[i] >= BOX - 0.5 && P.ex[i] > 3 && P.ex[i] < W - 3) {
      if (P.ebounce[i]) P.elife[i] = 0;
      else {
        P.ey[i] = BOX - 0.5;
        P.evy[i] *= -0.3;
        P.evx[i] *= 0.5;
        P.ebounce[i] = 1;
      }
    }
    if (P.ex[i] < 0 || P.ex[i] >= W || P.ey[i] >= H) P.elife[i] = 0;
  }
}

// Closest distance squared from every pixel near the segment, kept per pixel.
function stampSegment(P, x0, y0, x1, y1, R, box) {
  const dist = P.dist;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - R));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + R));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - R));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + R));
  if (minX > maxX || minY > maxY) return;
  if (minX < box[0]) box[0] = minX;
  if (maxX > box[1]) box[1] = maxX;
  if (minY < box[2]) box[2] = minY;
  if (maxY > box[3]) box[3] = maxY;
  const sx = x1 - x0;
  const sy = y1 - y0;
  const ll = sx * sx + sy * sy || 1e-6;
  for (let py = minY; py <= maxY; py++) {
    const cy = py + 0.5 - y0;
    for (let px = minX; px <= maxX; px++) {
      const cx = px + 0.5 - x0;
      let u = (cx * sx + cy * sy) / ll;
      if (u < 0) u = 0;
      else if (u > 1) u = 1;
      const ex = cx - u * sx;
      const ey = cy - u * sy;
      const d = ex * ex + ey * ey;
      const i = py * W + px;
      if (d < dist[i]) dist[i] = d;
    }
  }
}

export function draw(display, params, time) {
  const P = params;
  const core = P.core;
  const glow = P.glow;
  const warm = P.warm;
  const trail = P.trail;
  const dist = P.dist;
  const power = P.power;
  const air = P.air;
  core.fill(0);
  glow.fill(0);
  warm.fill(0);
  air.fill(0);

  // The hum: one beat bright, the rest of the cycle dimmer.
  const beat = Math.pow(Math.abs(Math.sin(Math.PI * HUM * P.t)), 6);
  const box = [W, -1, H, -1];
  for (let a = 0; a < ARCS; a++) {
    if (P.alive[a] === 0) continue;
    const live = P.alive[a] === 1;
    const age = P.age[a];
    const life = P.life[a];
    let b = (0.62 + 0.13 * power) * (0.84 + 0.16 * Math.random()) * (0.82 + 0.18 * beat);
    if (age < 0.1) b *= 1 + 1.3 * (1 - age / 0.1);
    if (!live) b *= life * life;
    const lambda = 2.6 + 0.6 * power + (live ? 0 : (1 - life) * 3);
    const sigma = (0.55 + 0.2 * power) * (live ? 1 : life * life + 0.05);
    const R = Math.ceil(lambda * 3.4);
    box[0] = W;
    box[1] = -1;
    box[2] = H;
    box[3] = -1;
    const o = a * PTS;
    const n = P.pn[a];
    for (let i = 0; i + 1 < n; i++) stampSegment(P, P.px[o + i], P.py[o + i], P.px[o + i + 1], P.py[o + i + 1], R, box);
    // The air: each grid point's distance to the nearest segment.
    const reachAir = 7 + 1.5 * power;
    for (let gy = 0; gy < GH; gy++) {
      const y = gy * CELL;
      for (let gx = 0; gx < GW; gx++) {
        const x = gx * CELL;
        let best = 1e9;
        for (let i = 0; i + 1 < n; i++) {
          const x0 = P.px[o + i];
          const y0 = P.py[o + i];
          const sx = P.px[o + i + 1] - x0;
          const sy = P.py[o + i + 1] - y0;
          const cx = x - x0;
          const cy = y - y0;
          let u = (cx * sx + cy * sy) / (sx * sx + sy * sy || 1e-6);
          if (u < 0) u = 0;
          else if (u > 1) u = 1;
          const ex = cx - u * sx;
          const ey = cy - u * sy;
          const d = ex * ex + ey * ey;
          if (d < best) best = d;
        }
        // Near the arc the air glows; further off, the room is only tinted.
        const d = Math.sqrt(best);
        air[gy * GW + gx] += b * (0.3 * Math.exp(-d / reachAir) + 0.07 * Math.exp(-d / 26));
      }
    }
    if (box[1] < box[0]) continue;
    const rr = R * R;
    for (let py = box[2]; py <= box[3]; py++) {
      for (let px = box[0]; px <= box[1]; px++) {
        const i = py * W + px;
        const d = dist[i];
        if (d >= 1e8) continue;
        dist[i] = 1e9;
        if (d > rr) continue;
        const c = d < 8 * sigma ? b * Math.exp(-d / sigma) : 0;
        const g = b * 0.7 * Math.exp(-Math.sqrt(d) / lambda);
        if (c > core[i]) core[i] = c;
        if (g > glow[i]) glow[i] = g;
      }
    }
    if (!live) continue;
    // The roots burn white on the rod.
    for (let e = 0; e < 2; e++) {
      const x = P.ends[a * 4 + e * 2];
      const y = P.ends[a * 4 + e * 2 + 1];
      for (let py = Math.floor(y) - 3; py <= Math.floor(y) + 3; py++) {
        if (py < 0 || py >= H) continue;
        for (let px = Math.floor(x) - 3; px <= Math.floor(x) + 3; px++) {
          if (px < 0 || px >= W) continue;
          const dx = px + 0.5 - x;
          const dy = py + 0.5 - y;
          const w = b * 1.1 * Math.exp(-(dx * dx + dy * dy) / 1.4);
          const i = py * W + px;
          if (w > warm[i]) warm[i] = w;
        }
      }
    }
  }

  // The trail: a camera left open keeps the bright beats and lets the rest go.
  const tau = 0.035 * Math.exp(4.6 * P.exposure);
  const keep = Math.exp(-P.dt / tau);
  const lay = 0.2 + 0.8 * beat;
  for (let i = 0; i < N; i++) {
    const v = Math.max(core[i] * 0.7, glow[i] * 1.3) * lay;
    const t = trail[i] * keep;
    trail[i] = v > t ? v : t;
  }
  // The glowing air is kept the same way, as a haze through the V.
  const airTrail = P.airTrail;
  for (let q = 0; q < GW * GH; q++) {
    const t = airTrail[q] * keep;
    airTrail[q] = air[q] > t ? air[q] : t;
    const h = airTrail[q] * 0.8;
    if (h > air[q]) air[q] = h;
  }

  const col = P.col;
  const hue = P.hue + 0.74;
  hsv(hue, 0.78, 1, col, 0);
  hsv(hue, 0.22, 1, col, 3);
  hsv(hue + 0.02, 0.6, 0.9, col, 6);
  const amb = 0.62 + 0.3 * P.flash;
  // Steel and glaze take on the colour of the light that falls on them.
  const tr = 0.45 + 0.55 * (col[0] / 255);
  const tg = 0.45 + 0.55 * (col[1] / 255);
  const tb = 0.45 + 0.55 * (col[2] / 255);
  const st = P.stat;
  const out = P.out;
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) / CELL;
    const gy = Math.min(GH - 2, Math.floor(fy));
    const vy = fy - gy;
    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / CELL;
      const gx = Math.min(GW - 2, Math.floor(fx));
      const vx = fx - gx;
      const q = gy * GW + gx;
      const top = air[q] + (air[q + 1] - air[q]) * vx;
      const bottom = air[q + GW] + (air[q + GW + 1] - air[q + GW]) * vx;
      const ai = top + (bottom - top) * vy;
      const i = y * W + x;
      const o = i * 3;
      const g = Math.max(glow[i], trail[i] * 0.85);
      const c = core[i];
      const w = warm[i];
      const lit = 1.6 * g + 2.2 * ai + 1.2 * w;
      out[o] = st[o] * (amb + lit * tr) + c * col[3] + glow[i] * col[0] + (g - glow[i]) * col[6] + ai * col[0] + w * 255;
      out[o + 1] = st[o + 1] * (amb + lit * tg) + c * col[4] + glow[i] * col[1] + (g - glow[i]) * col[7] + ai * col[1] + w * 196;
      out[o + 2] = st[o + 2] * (amb + lit * tb) + c * col[5] + glow[i] * col[2] + (g - glow[i]) * col[8] + ai * col[2] + w * 130;
    }
  }
  // The pilot lamp on the box, and the sparks: white-hot, cooling to red.
  for (let py = BOX + 4; py <= BOX + 5; py++) {
    for (let px = 7; px <= 8; px++) {
      const o = (py * W + px) * 3;
      out[o] = 236;
      out[o + 1] = 120 + 40 * P.flash;
      out[o + 2] = 36;
    }
  }
  for (let i = 0; i < EMBERS; i++) {
    if (P.elife[i] <= 0) continue;
    const u = P.elife[i] / P.emax[i];
    const px = Math.floor(P.ex[i]);
    const py = Math.floor(P.ey[i]);
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    const o = (py * W + px) * 3;
    const v = 0.35 + 0.65 * u;
    out[o] += 255 * v;
    out[o + 1] += (60 + 170 * u * u) * v;
    out[o + 2] += 90 * u * u * u * v;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, out[o]), Math.min(255, out[o + 1]), Math.min(255, out[o + 2]));
    }
  }
}
