// ===== Patternflow pattern =====
// Title:   Trip-let
// Family:  type
// Idea:    A block carved as the intersection of three extruded letters turns in a slanting beam of light, a third of a turn at a time about its own diagonal, and each time one of its axes comes round to the beam the long shadow it throws across the floor stops being a lump and becomes a whole letter, G, then E, then B.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the trip-let of Gödel, Escher, Bach (Douglas Hofstadter, 1979), letters drawn for this pattern, pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Letters=0..5, Haze=0..1
//
// Knob 1: Hue. Turns the three lights round the wheel together. At 0 the beam is a pale azure white, so the pool on the floor is pale blue and the letter in it deep violet, and the block's faces take a violet light from the front left and a pink one from the right; at 0.5 the beam is pale peach and the block yellow-green.
// Knob 2: Speed. At 2 the block holds each lined-up pose 1.6 s and takes 2.4 s over the next third of a turn, so the three letters come round every 12 s. At 0.2 a letter holds 16 s, at 3 a whole round takes 8 s.
// Knob 3: Letters. Which block hangs in the beam: 0 GEB, 1 EGB (the cover's second block), 2 LED, 3 SUN, 4 ONE, 5 SEE, carved from 235, 240, 150, 182, 200 and 216 of the 512 voxels. Each was checked with all three letters whole in its shadow; with these glyphs YES, EYE, LUX, FUN and HUE are not, and LED only became whole once the right side of the D was carried down into its second row from the bottom.
// Knob 4: Haze. Dust in the air, so the beam shows: the sky above the block reads 31/255 at the opening 0.06, 91 at 0.5 and 159 at 1, with the dark column of the shadow running from the block down to its letter.

// The block is built from the letters and the shadows are cast from the
// block: each frame a shadow map is marched through the voxels along the
// beam, and the floor and the haze are lit or not from that map alone.
// Read back at the 18 lined-up poses, each map matches its letter, scaled
// to four texels a cell, on all 3600 texels, and the floor shows it as a
// 32 x 32 LED letter, four LEDs a cell, without one LED wrong.
const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, abs, PI } = Math;
const N = 8, U = 4, HALFB = (N * U) / 2;
// Camera: orthographic, looking down at EL. The light comes from behind the
// block, ALPHA from straight up, at the same elevation as the camera, which
// is what lets the long shadow read on the panel at its true shape.
const EL = (35 * PI) / 180, SE = sin(EL), CE = cos(EL);
const ALPHA = PI / 2 - EL, SA = sin(ALPHA), CA = cos(ALPHA);
// The block's centre hangs HB above the floor, 39.07 units, chosen so that
// at the lined-up poses every texel of the shadow lands on one LED.
const HB = 32 / SA;
const YC = 64; // screen row of the point of the floor under the block
const RP = 30; // radius of the beam
const MS = 2 * RP; // shadow map texels a side, one world unit each
const WFAR = 80; // where the map's lines of light start, below the block

// 8x8 letters, rows from the top, bit 7 the left column.
const GLYPHS = {
  G: [0x7e, 0xff, 0xc0, 0xcf, 0xcf, 0xc3, 0xff, 0x7e],
  E: [0xff, 0xff, 0xc0, 0xfc, 0xfc, 0xc0, 0xff, 0xff],
  B: [0xfe, 0xff, 0xc3, 0xfe, 0xfe, 0xc3, 0xff, 0xfe],
  L: [0xc0, 0xc0, 0xc0, 0xc0, 0xc0, 0xc0, 0xff, 0xff],
  D: [0xfe, 0xff, 0xc3, 0xc3, 0xc3, 0xc3, 0xff, 0xfe],
  S: [0x7f, 0xff, 0xc0, 0xfe, 0x7f, 0x03, 0xff, 0xfe],
  U: [0xc3, 0xc3, 0xc3, 0xc3, 0xc3, 0xc3, 0xff, 0x7e],
  N: [0xc3, 0xe3, 0xf3, 0xdb, 0xdb, 0xcf, 0xc7, 0xc3],
  O: [0x7e, 0xff, 0xc3, 0xc3, 0xc3, 0xc3, 0xff, 0x7e],
};
const WORDS = ["GEB", "EGB", "LED", "SUN", "ONE", "SEE"];

const lit = (ch, h, v) => (GLYPHS[ch][N - 1 - v] >> (N - 1 - h)) & 1;

// The block: voxel (x, y, z) is solid when all three letters are lit where
// it falls. Letter 0 is seen along x (h = y, v = z), letter 1 along y
// (h = z, v = x), letter 2 along z (h = x, v = y).
function carve(S, word) {
  const vox = S.vox;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++)
        vox[(x * N + y) * N + z] = lit(word[0], y, z) & lit(word[1], z, x) & lit(word[2], x, y);
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    vox: new Uint8Array(N * N * N),
    word: -1,
    phase: 0,
    R: new Float64Array(9),
    top: new Float32Array(MS * MS),
    hit: [0, 0],
    key: [0, 0, 0],
    fill: [0, 0, 0],
    side: [0, 0, 0],
  };
}

const ease = (f) => f * f * f * (f * (f * 6 - 15) + 10);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = k[1];
  S.haze = k[3];
  const w = max(0, min(WORDS.length - 1, Math.round(k[2])));
  if (w !== S.word) {
    S.word = w;
    carve(S, WORDS[w]);
  }
  S.phase += (dt * S.speed) / 8;
  // A third of a turn about the block's diagonal at each step, so its axes
  // come round x -> light, y -> light, z -> light: letter 0, 1, 2 in turn.
  const step = floor(S.phase), f = S.phase - step;
  const HOLD = 0.4;
  const g = f < HOLD ? 0 : ease((f - HOLD) / (1 - HOLD));
  const th = (-2 * PI / 3) * (1 + step + g);
  const c = cos(th), s = sin(th), t = 1 - c, a = 1 / sqrt(3);
  // Rodrigues about (a, a, a): D maps x -> y -> z -> x at th = 2 pi / 3.
  const d0 = c + a * a * t, d1 = a * a * t - a * s, d2 = a * a * t + a * s;
  // Then T, whose columns are x, (0, CA, -SA) and (0, SA, CA), tilts z
  // towards the light.
  // R = T D, rows of D: [d0 d1 d2], [d2 d0 d1], [d1 d2 d0].
  const R = S.R;
  R[0] = d0; R[1] = d1; R[2] = d2;
  R[3] = CA * d2 + SA * d1; R[4] = CA * d0 + SA * d2; R[5] = CA * d1 + SA * d0;
  R[6] = -SA * d2 + CA * d1; R[7] = -SA * d0 + CA * d2; R[8] = -SA * d1 + CA * d0;
}

// Amanatides-Woo through the voxel grid from grid point (ox, oy, oz) along
// (dx, dy, dz). Returns the entry t of the first solid voxel, its face in
// S.hit as axis and sign, or -1. With last it returns the exit t of the last
// solid voxel instead.
function march(S, ox, oy, oz, dx, dy, dz, last) {
  let t0 = -1e9, t1 = 1e9, ax = -1;
  const E = 1e-12;
  if (abs(dx) < E) { if (ox < 0 || ox > N) return -1; }
  else { let a = -ox / dx, b = (N - ox) / dx; if (a > b) { const q = a; a = b; b = q; } if (a > t0) { t0 = a; ax = 0; } if (b < t1) t1 = b; }
  if (abs(dy) < E) { if (oy < 0 || oy > N) return -1; }
  else { let a = -oy / dy, b = (N - oy) / dy; if (a > b) { const q = a; a = b; b = q; } if (a > t0) { t0 = a; ax = 1; } if (b < t1) t1 = b; }
  if (abs(dz) < E) { if (oz < 0 || oz > N) return -1; }
  else { let a = -oz / dz, b = (N - oz) / dz; if (a > b) { const q = a; a = b; b = q; } if (a > t0) { t0 = a; ax = 2; } if (b < t1) t1 = b; }
  if (t0 > t1 || t1 < 0) return -1;
  let t = max(t0, 0);
  const te = t + 1e-6;
  let ix = floor(ox + dx * te), iy = floor(oy + dy * te), iz = floor(oz + dz * te);
  ix = ix < 0 ? 0 : ix >= N ? N - 1 : ix;
  iy = iy < 0 ? 0 : iy >= N ? N - 1 : iy;
  iz = iz < 0 ? 0 : iz >= N ? N - 1 : iz;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const ddx = abs(dx) < E ? 1e9 : abs(1 / dx), ddy = abs(dy) < E ? 1e9 : abs(1 / dy), ddz = abs(dz) < E ? 1e9 : abs(1 / dz);
  let mx = abs(dx) < E ? 1e9 : ((dx > 0 ? ix + 1 : ix) - ox) / dx;
  let my = abs(dy) < E ? 1e9 : ((dy > 0 ? iy + 1 : iy) - oy) / dy;
  let mz = abs(dz) < E ? 1e9 : ((dz > 0 ? iz + 1 : iz) - oz) / dz;
  const vox = S.vox;
  let found = -1;
  for (;;) {
    if (vox[(ix * N + iy) * N + iz]) {
      if (!last) { S.hit[0] = ax; S.hit[1] = ax === 0 ? -sx : ax === 1 ? -sy : -sz; return t; }
      found = min(mx, my, mz);
    }
    if (mx <= my && mx <= mz) { ix += sx; t = mx; mx += ddx; ax = 0; if (ix < 0 || ix >= N) break; }
    else if (my <= mz) { iy += sy; t = my; my += ddy; ax = 1; if (iy < 0 || iy >= N) break; }
    else { iz += sz; t = mz; mz += ddz; ax = 2; if (iz < 0 || iz >= N) break; }
  }
  return found;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const R = S.R, top = S.top;
  const key = S.key, fill = S.fill, side = S.side;
  hsv(S.hue + 0.55, 0.16, 1.25, key);
  hsv(S.hue + 0.71, 0.62, 1, fill);
  hsv(S.hue + 0.9, 0.5, 1, side);
  // world (relative to the block's centre) -> grid
  const gx = (x, y, z) => (R[0] * x + R[3] * y + R[6] * z) / U + N / 2;
  const gy = (x, y, z) => (R[1] * x + R[4] * y + R[7] * z) / U + N / 2;
  const gz = (x, y, z) => (R[2] * x + R[5] * y + R[8] * z) / U + N / 2;
  // beam frame: eu = x, ev = (0, CA, -SA), eL = (0, SA, CA) towards the light
  const Ly = SA, Lz = CA;
  const lgx = (R[3] * Ly + R[6] * Lz) / U, lgy = (R[4] * Ly + R[7] * Lz) / U, lgz = (R[5] * Ly + R[8] * Lz) / U;
  // Shadow map over the beam's cross-section: how far along eL the block
  // reaches on each line of light (-1e9 where the line misses it).
  for (let j = 0; j < MS; j++)
    for (let i = 0; i < MS; i++) {
      const u = i - RP + 0.5, v = j - RP + 0.5;
      const x = u, y = v * CA - WFAR * SA, z = -v * SA - WFAR * CA;
      const t = march(S, gx(x, y, z), gy(x, y, z), gz(x, y, z), lgx, lgy, lgz, true);
      top[j * MS + i] = t < 0 ? -1e9 : t - WFAR;
    }
  const lit3 = (x, y, z) => {
    // x, y, z relative to the block's centre
    const v = y * CA - z * SA, w = y * SA + z * CA;
    const i = floor(x + RP), j = floor(v + RP);
    if (i < 0 || j < 0 || i >= MS || j >= MS) return 1;
    return top[j * MS + i] > w ? 0 : 1;
  };
  // camera: forward f = (0, CE, -SE), up = (0, SE, CE), right = x
  const fy = CE, fz = -SE;
  const cgx = (R[3] * fy + R[6] * fz) / U, cgy = (R[4] * fy + R[7] * fz) / U, cgz = (R[5] * fy + R[8] * fz) / U;
  // two fills without shadows: the sky from the front left, a weaker one from the right
  const AX = -0.62, AY = -0.62, AZ = 0.48, BX = 0.85, BY = -0.35, BZ = 0.4;
  const al = 1 / Math.hypot(AX, AY, AZ), bl = 1 / Math.hypot(BX, BY, BZ);
  const hazeK = 0.0012 + 0.007 * S.haze;
  for (let py = 0; py < H; py++) {
    const Y = YC - (py + 0.5);
    for (let px = 0; px < W; px++) {
      const X = px + 0.5 - W / 2;
      // the ray through this LED, relative to the block's centre
      const cx = X, cy = Y * SE, cz = Y * CE - HB;
      let r = 0, g = 0, b = 0;
      const tc = -(cy * fy + cz * fz);
      const ex = cx, ey = cy + fy * tc, ez = cz + fz * tc;
      let tBlock = 1e9;
      if (ex * ex + ey * ey + ez * ez < HALFB * HALFB * 3) {
        const t0 = tc - 2 * HALFB;
        const ox = cx, oy = cy + fy * t0, oz = cz + fz * t0;
        const tt = march(S, gx(ox, oy, oz), gy(ox, oy, oz), gz(ox, oy, oz), cgx, cgy, cgz, false);
        if (tt >= 0) {
          tBlock = t0 + tt;
          const ax = S.hit[0], sg = S.hit[1];
          const nx = R[ax] * sg, ny = R[3 + ax] * sg, nz = R[6 + ax] * sg;
          const hx = cx, hy = cy + fy * tBlock, hz = cz + fz * tBlock;
          let kl = max(0, ny * Ly + nz * Lz);
          if (kl > 0) {
            const q = 0.05;
            const qx = hx + nx * q, qy = hy + ny * q, qz = hz + nz * q;
            if (march(S, gx(qx, qy, qz), gy(qx, qy, qz), gz(qx, qy, qz), lgx, lgy, lgz, false) >= 0) kl = 0;
          }
          const fa = max(0, (nx * AX + ny * AY + nz * AZ) * al), fb = max(0, (nx * BX + ny * BY + nz * BZ) * bl);
          r = key[0] * kl + fill[0] * (0.05 + 0.7 * fa) + side[0] * 0.35 * fb;
          g = key[1] * kl + fill[1] * (0.05 + 0.7 * fa) + side[1] * 0.35 * fb;
          b = key[2] * kl + fill[2] * (0.05 + 0.7 * fa) + side[2] * 0.35 * fb;
        }
      }
      // floor: world z = 0, which is z = -HB here
      const tf = (cz + HB) / SE;
      if (tBlock > 1e8) {
        const wx = cx, wy = cy + fy * tf;
        if (abs(wx) <= W / 2 && wy < 40 && wy > -110) {
          const v = wy * CA + HB * SA;
          const rr = sqrt(wx * wx + v * v);
          const pool = rr < RP - 0.5 ? 1 : rr > RP + 0.5 ? 0 : RP + 0.5 - rr;
          const kk = pool > 0 ? pool * lit3(wx, wy, -HB) * CA : 0;
          const ff = 0.12;
          r = key[0] * kk + fill[0] * ff;
          g = key[1] * kk + fill[1] * ff;
          b = key[2] * kk + fill[2] * ff;
        }
      }
      // haze in the beam, in front of whatever the ray meets
      if (abs(cx) < RP) {
        const hw = sqrt(RP * RP - cx * cx);
        const v0 = cy * CA - cz * SA, dv = fy * CA - fz * SA;
        let ta = (-hw - v0) / dv, tb = (hw - v0) / dv;
        if (ta > tb) { const q = ta; ta = tb; tb = q; }
        tb = min(tb, tf, tBlock);
        ta = max(ta, -200);
        if (tb > ta) {
          const n = 16, dtt = (tb - ta) / n;
          let acc = 0;
          for (let i = 0; i < n; i++) {
            const t = ta + (i + 0.5) * dtt;
            acc += lit3(cx, cy + fy * t, cz + fz * t);
          }
          const hz = acc * dtt * hazeK;
          r += key[0] * hz; g += key[1] * hz; b += key[2] * hz;
        }
      }
      display.setPixel(px, py, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
  }
}
