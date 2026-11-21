// ===== Patternflow pattern =====
// Title:   Hypostyle
// Family:  architecture
// Idea:    A walk without end through a foggy hall of round columns on a square grid, where the heading drifts and a long clear aisle opens to the vanishing point each time it lines up with a direction of the grid, then closes into a thicket again.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hypostyle halls; the aisles that open and close when you walk through columns on a grid
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Girth=-1..1, Clear=0..1
//
// Knob 1: Hue. The colour of the fog and of the shaded side of the columns, from a cool teal blue where the knob opens round the wheel. The light on the lit flank and in the lamp columns keeps to the other side of the wheel, a warm cream and amber at the opening.
// Knob 2: Pace. How fast the walker goes. At the bottom the walker stands and only the heading drifts a little; where the knob opens it is about 0.9 cells a second, and at the top about 1.35.
// Knob 3: Girth. How thick the columns are, from slim poles 0.14 of a cell across at the bottom, through a third of a cell where the knob opens, to fat piers 0.6 across at the top with narrow gaps between them.
// Knob 4: Clear. How far the eye reaches. At the bottom the fog swallows a column within four or five cells; at the top the hall is clear for twenty and the dark ceiling shows. It opens near the bottom.

const W = 64;
const H = 128;
// Rays cast for each column of LEDs, the focal length in LEDs and the row of the horizon.
const SUB = 4;
const FOCAL = 60;
const HOR = 84;
// The height of the eye and of the ceiling, in cells, and how far a ray looks.
const EYE = 0.32;
const CEIL = 6;
const REACH = 22;
// Where the walk starts and which way it faces then.
const HOME = [1.2, 5];
const FIRST = -0.21;
// The walker keeps this far from the face of a column, and plans for ROOM to the side of each one.
const KEEP = 0.14;
const ROOM = 0.5;
// The table the walker plans on: steps ahead and their length, places to each side and their width,
// how far aside one step may go, and what a sidestep and a change of mind cost.
const STEPS = 14;
const STEP = 0.25;
const SIDES = 14;
const SIDE = 0.05;
const TURN = 3;
const SWERVE = 0.06;
const HABIT = 1.5;
// The compass direction the light comes from.
const SUN = 1.2;
// How high up a column the polished floor still shows it, and over how much of its height a column fades into the ceiling, in cells.
const GLOSS = 1.3;
const GLOOM = 2.5;
// How many LEDs to either side a lamp's glow spreads in the fog.
const SPREAD = 7;
// How high the lantern on a lamp column reaches, in cells.
const LANTERN = 0.9;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
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

// What stands in a cell: 0 a clearing, 1 a column, 2 a lamp column.
function kind(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const u = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  return u < 0.1 ? 0 : u < 0.145 ? 2 : 1;
}

// The heading is a sum of slow swings whose periods do not divide each other.
function swing(s) {
  return 1.15 * Math.sin(0.0231 * s + 3.3) + 0.8 * Math.sin(0.0387 * s + 0.2) + 0.45 * Math.sin(0.0713 * s + 6.1) + 0.1 * Math.sin(0.171 * s);
}

function heading(s) {
  return FIRST + swing(s) - swing(0);
}

export function setup(params) {
  params.x = HOME[0];
  params.z = HOME[1];
  params.s = 0;
  params.side = 0;
  params.lean = 0;
  params.a = heading(0);
  params.r = 0.14;
  params.fog = 5.4;
  params.hue = 0;
  params.ray = new Float32Array(4);
  params.la = new Float32Array(64);
  params.lo = new Float32Array(64);
  params.cost = new Float32Array((STEPS + 1) * (2 * SIDES + 1));
  params.hits = new Float32Array(W * SUB * 4);
  params.halo = new Float32Array(W);
  params.acc = new Float32Array(H * 3);
  params.sky = new Float32Array(H * 3);
  params.up = new Float32Array(H * 3);
  params.mist = new Float32Array(H * 3);
  params.shine = new Float32Array(H);
  params.lift = new Float32Array(H);
  params.bloom = new Float32Array(H);
  params.c = { fog: [0, 0, 0], shade: [0, 0, 0], light: [0, 0, 0], lamp: [0, 0, 0], roof: [0, 0, 0] };
}

// The walker looks a few cells ahead and finds the path that passes the columns there with the most room:
// a table of steps ahead by places to the side, each place costed by the columns beside it and in front of it,
// filled from the far end back. The answer is how far to step aside for each cell walked.
function plan(params, fx, fz, r) {
  const { la, lo, cost } = params;
  const ci = Math.floor(params.x);
  const cj = Math.floor(params.z);
  let n = 0;
  for (let j = cj - 6; j <= cj + 6; j++)
    for (let i = ci - 6; i <= ci + 6; i++) {
      if (!kind(i, j)) continue;
      const ox = i + 0.5 - params.x;
      const oz = j + 0.5 - params.z;
      const ahead = ox * fx + oz * fz;
      const off = oz * fx - ox * fz;
      if (ahead < -0.4 || ahead > STEPS * STEP + 1.5 || Math.abs(off) > SIDES * SIDE + ROOM || n >= la.length) continue;
      la[n] = ahead;
      lo[n++] = off;
    }
  const wide = 2 * SIDES + 1;
  const tight = (r + KEEP + 0.03) * (r + KEEP + 0.03);
  for (let s = STEPS; s >= 1; s--) {
    const at = s * STEP;
    for (let l = 0; l < wide; l++) {
      const to = (l - SIDES) * SIDE;
      let c = 0;
      for (let m = 0; m < n; m++) {
        const da = la[m] - at;
        if (da < -0.4 || da > 1.5) continue;
        const gap = Math.abs(lo[m] - to);
        if (gap >= ROOM) continue;
        const u = 1 - gap / ROOM;
        c += u * u * (da < 0.25 ? 1 : (1.5 - da) / 1.25);
        if (da * da + gap * gap < tight) c += 40;
      }
      if (s < STEPS) {
        let least = 1e9;
        for (let q = -TURN; q <= TURN; q++) {
          const k = l + q;
          if (k < 0 || k >= wide) continue;
          const v = cost[(s + 1) * wide + k] + SWERVE * q * q;
          if (v < least) least = v;
        }
        c += least;
      }
      cost[s * wide + l] = c;
    }
  }
  // The first step also counts what it costs to change the sidestep the walker is already making.
  let best = 0;
  let least = 1e9;
  for (let q = -TURN; q <= TURN; q++) {
    const lean = (q * SIDE) / STEP;
    const v = cost[wide + SIDES + q] + SWERVE * q * q + HABIT * (lean - params.lean) * (lean - params.lean);
    if (v < least) {
      least = v;
      best = lean;
    }
  }
  params.lean = best;
  return best;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const pace = clamp(k[1], 0, 3);
  const girth = clamp(k[2], -1, 1);
  const r = girth < 0 ? 0.14 + 0.07 * girth : 0.14 + 0.16 * girth;
  params.hue = k[0];
  params.r = r;
  params.fog = 4.5 + 15.5 * clamp(k[3], 0, 1);
  // The heading keeps drifting a little when the walker stands.
  params.s += dt * (0.3 + 0.35 * pace);
  const a = heading(params.s);
  params.a = a;
  const fx = Math.cos(a);
  const fz = Math.sin(a);
  const speed = 0.45 * pace;
  if (speed > 0) params.side += (plan(params, fx, fz, r) * speed - params.side) * (1 - Math.exp(-dt / 0.25));
  else params.side = 0;
  params.x += (fx * speed - fz * params.side) * dt;
  params.z += (fz * speed + fx * params.side) * dt;
  // And a column never comes closer than KEEP: the walker slides round it.
  const ci = Math.floor(params.x);
  const cj = Math.floor(params.z);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (!kind(i, j)) continue;
      const ox = params.x - (i + 0.5);
      const oz = params.z - (j + 0.5);
      const d = Math.sqrt(ox * ox + oz * oz);
      if (d < r + KEEP && d > 1e-6) {
        params.x = i + 0.5 + (ox / d) * (r + KEEP);
        params.z = j + 0.5 + (oz / d) * (r + KEEP);
      }
    }
}

// Walk the cells along a ray and stop at the first column it meets.
// out: distance (0 for none), the two parts of the normal there, the kind.
function cast(px, pz, dx, dz, r, out) {
  let ci = Math.floor(px);
  let cj = Math.floor(pz);
  const si = dx > 0 ? 1 : -1;
  const sj = dz > 0 ? 1 : -1;
  const ex = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : 1e9;
  const ez = Math.abs(dz) > 1e-9 ? Math.abs(1 / dz) : 1e9;
  let tx = (dx > 0 ? ci + 1 - px : px - ci) * ex;
  let tz = (dz > 0 ? cj + 1 - pz : pz - cj) * ez;
  const r2 = r * r;
  let t0 = 0;
  out[0] = 0;
  while (t0 < REACH) {
    const what = kind(ci, cj);
    if (what) {
      const ox = ci + 0.5 - px;
      const oz = cj + 0.5 - pz;
      const along = ox * dx + oz * dz;
      if (along > 0) {
        const off2 = ox * ox + oz * oz - along * along;
        if (off2 < r2) {
          const t = along - Math.sqrt(r2 - off2);
          if (t > 0 && t < REACH) {
            out[0] = t;
            out[1] = (dx * t - ox) / r;
            out[2] = (dz * t - oz) / r;
            out[3] = what;
          }
          return;
        }
      }
    }
    if (tx < tz) {
      t0 = tx;
      tx += ex;
      ci += si;
    } else {
      t0 = tz;
      tz += ez;
      cj += sj;
    }
  }
}

export function draw(display, params) {
  const { ray, hits, halo, acc, sky, up, mist, shine, lift, bloom, c } = params;
  const len = params.fog;
  // Fog thickens with distance and has swallowed everything by the end of the reach.
  const veil = (d) => {
    if (d >= REACH) return 1;
    const f = 1 - Math.exp(-d / len);
    const e = clamp((d - 0.7 * REACH) / (0.3 * REACH), 0, 1);
    return f + (1 - f) * e * e * (3 - 2 * e);
  };
  hsv(params.hue + 0.52, 0.32, 0.84, c.fog);
  hsv(params.hue + 0.6, 0.62, 0.24, c.shade);
  hsv(params.hue + 0.1, 0.3, 1, c.light);
  hsv(params.hue + 0.07, 0.6, 1, c.lamp);
  hsv(params.hue + 0.61, 0.6, 0.12, c.roof);
  const lx = Math.cos(SUN);
  const lz = Math.sin(SUN);
  // With the light at the walker's back the columns would be lit flat, so it counts for less there.
  const back = 1 - 0.92 * clamp(-1.25 * Math.cos(SUN - params.a), 0, 1);

  // Row by row: the fog, brightest along the horizon, and what a ray that meets no column shows,
  // the ceiling above the horizon and the floor below it.
  for (let y = 0; y < H; y++) {
    const j = y * 3;
    const rise = (HOR - y - 0.5) / (y < HOR ? 54 : 70);
    lift[y] = 0.56 + 0.44 * Math.exp(-rise * rise);
    // A glow in the fog keeps closer to the horizon, and the floor shows a little of it.
    const band = (HOR - y - 0.5) / (y < HOR ? 30 : 9);
    bloom[y] = Math.exp(-band * band) * (y < HOR ? 1 : 0.6);
    for (let q = 0; q < 3; q++) mist[j + q] = c.fog[q] * lift[y];
    if (y < HOR) {
      const f = veil(((CEIL - EYE) * FOCAL) / (HOR - y - 0.5));
      for (let q = 0; q < 3; q++) sky[j + q] = c.roof[q] + (mist[j + q] - c.roof[q]) * f;
      shine[y] = 0;
    } else {
      // The floor is dark and polished: it mirrors the ceiling and the fog, most at a glancing angle.
      const drop = y + 0.5 - HOR;
      const f = veil(((CEIL + EYE) * FOCAL) / drop);
      const m = 0.3 + 0.7 * Math.exp(-drop / 14);
      const near = veil((EYE * FOCAL) / drop);
      shine[y] = m * (1 - near);
      for (let q = 0; q < 3; q++) {
        // What the mirror would show there with no column in it.
        const over = c.roof[q] + (mist[j + q] - c.roof[q]) * f;
        const own = c.fog[q] * 0.26 * (1 - m) + over * m;
        up[j + q] = over;
        sky[j + q] = own + (mist[j + q] - own) * near;
      }
    }
  }

  // Cast every ray first, and gather how much lamp each column of LEDs sees.
  halo.fill(0);
  for (let i = 0; i < W * SUB; i++) {
    const turn = Math.atan(((i + 0.5) / SUB - W / 2) / FOCAL);
    cast(params.x, params.z, Math.cos(params.a + turn), Math.sin(params.a + turn), params.r, ray);
    hits.set(ray, i * 4);
    if (ray[0] > 0 && ray[3] === 2) halo[(i / SUB) | 0] += (1 - veil(ray[0] * 0.55)) / SUB;
  }

  for (let sx = 0; sx < W; sx++) {
    // A lamp spreads a little of its colour into the fog to either side of it,
    // and the fog is warmer and brighter towards the light.
    let warm = 0;
    for (let q = -SPREAD; q <= SPREAD; q++) {
      const k = sx + q;
      if (k >= 0 && k < W) warm += halo[k] * (1 - Math.abs(q) / (SPREAD + 1));
    }
    warm *= 0.3 / (SPREAD + 1);
    const to = Math.cos(params.a + Math.atan((sx + 0.5 - W / 2) / FOCAL) - SUN);
    const sun = to > 0 ? 0.2 * to * to * to * to * to * to : 0;
    const sr = c.light[0] * sun;
    const sg = c.light[1] * sun;
    const sb = c.light[2] * sun;
    acc.fill(0);
    for (let s = 0; s < SUB; s++) {
      const i = sx * SUB + s;
      const t = hits[i * 4];
      // Where the eye reaches far down an open aisle, daylight shows at the end of it.
      const far = clamp(((t > 0 ? t : REACH) - 6) / 10, 0, 1);
      const deep = 0.34 * far * far * (3 - 2 * far);
      const ar = c.lamp[0] * warm + c.light[0] * deep;
      const ag = c.lamp[1] * warm + c.light[1] * deep;
      const ab = c.lamp[2] * warm + c.light[2] * deep;
      if (t <= 0) {
        for (let y = 0, j = 0; y < H; y++, j += 3) {
          acc[j] += sky[j] + ar * bloom[y] + sr * lift[y];
          acc[j + 1] += sky[j + 1] + ag * bloom[y] + sg * lift[y];
          acc[j + 2] += sky[j + 2] + ab * bloom[y] + sb * lift[y];
        }
        continue;
      }
      const turn = Math.atan(((i + 0.5) / SUB - W / 2) / FOCAL);
      const dx = Math.cos(params.a + turn);
      const dz = Math.sin(params.a + turn);
      const nx = hits[i * 4 + 1];
      const nz = hits[i * 4 + 2];
      const d = t * Math.cos(turn);
      // How squarely the surface faces the eye: 1 in the middle of the column, 0 at its edge.
      const face = clamp(-(nx * dx + nz * dz), 0, 1);
      const edge = Math.sqrt(1 - face * face);
      const f = veil(t);
      const g = 1 - f;
      // The light falls from one side and counts for most on a flank; the fog lights both edges a little.
      const lit = 0.85 * back * Math.pow(clamp(nx * lx + nz * lz, 0, 1), 1.3) * (0.3 + 0.7 * edge);
      const rim = 0.3 * edge * edge * edge;
      let br = c.shade[0] + (c.fog[0] - c.shade[0]) * rim;
      let bg = c.shade[1] + (c.fog[1] - c.shade[1]) * rim;
      let bb = c.shade[2] + (c.fog[2] - c.shade[2]) * rim;
      br += (c.light[0] - br) * lit;
      bg += (c.light[1] - bg) * lit;
      bb += (c.light[2] - bb) * lit;
      // A lamp column carries a lantern: its lowest stretch glows of itself, most along its middle,
      // and the fog hides that later than it hides the column.
      const lamp = hits[i * 4 + 3] === 2;
      const f2 = lamp ? veil(t * 0.55) : 1;
      const glow = (0.3 + 0.7 * face * face) * (1 - f2);
      const top = HOR - ((CEIL - EYE) * FOCAL) / d;
      const foot = HOR + (EYE * FOCAL) / d;
      const gloom = Math.max(1, (GLOOM * FOCAL) / d);
      for (let y = 0, j = 0; y < H; y++, j += 3) {
        // How much of the column this row shows: it fades into the ceiling at its top and ends at its foot.
        let body = 1 - clamp(y + 1 - foot, 0, 1);
        if (y < HOR) {
          const u = clamp((y + 0.5 - top) / gloom, 0, 1);
          body = u * u * (3 - 2 * u);
        }
        let r = sky[j];
        let gr = sky[j + 1];
        let b = sky[j + 2];
        // The fog in this row, and the column as the fog leaves it.
        const mr = mist[j] + ar * bloom[y] + sr * lift[y];
        const mg = mist[j + 1] + ag * bloom[y] + sg * lift[y];
        const mb = mist[j + 2] + ab * bloom[y] + sb * lift[y];
        let cr = br * g + mr * f;
        let cg = bg * g + mg * f;
        let cb = bb * g + mb * f;
        // How high up the column this row looks, straight or by way of the floor.
        const h = Math.abs(((y + 0.5 - HOR) * d) / FOCAL - (y + 1 > foot ? EYE : 0) * 2 + EYE);
        if (lamp && h < LANTERN + 1.4) {
          const u = clamp((LANTERN + 1.4 - h) / 1.4, 0, 1);
          const w = u * u * (3 - 2 * u);
          cr += (c.lamp[0] * glow + mr * f2 - cr) * w;
          cg += (c.lamp[1] * glow + mg * f2 - cg) * w;
          cb += (c.lamp[2] * glow + mb * f2 - cb) * w;
        }
        if (body < 1 && y >= HOR) {
          // The floor mirrors the column, less and less the higher up the column it looks.
          const m = shine[y] * 0.85 * Math.exp(-h / GLOSS);
          r += (cr - up[j]) * m;
          gr += (cg - up[j + 1]) * m;
          b += (cb - up[j + 2]) * m;
        }
        if (body > 0) {
          r += (cr - r) * body;
          gr += (cg - gr) * body;
          b += (cb - b) * body;
        }
        acc[j] += r;
        acc[j + 1] += gr;
        acc[j + 2] += b;
      }
    }
    const scale = 255 / SUB;
    for (let y = 0, j = 0; y < H; y++, j += 3) display.setPixel(sx, y, clamp(acc[j] * scale, 0, 255), clamp(acc[j + 1] * scale, 0, 255), clamp(acc[j + 2] * scale, 0, 255));
  }
}
