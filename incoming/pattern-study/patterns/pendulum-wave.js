// ===== Patternflow pattern =====
// Title:   Pendulum Wave
// Family:  physics
// Idea:    Seen straight down from above, a row of pendulums hangs from a beam down the middle of a lamplit table, each shorter one swinging once more per cycle than the last, so the row that leaves the release board as one straight line winds into a travelling snake and splits into three and two interleaved rows before it scatters and lines up again at the end of the cycle.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the pendulum wave demonstration of the Harvard Natural Sciences Lecture Demonstrations, fifteen pendulums tuned to 51 to 65 swings a minute
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Finish=0..1, Speed=0.2..3, Pendulums=16..24, Trails=0..1
//
// Knob 1: Finish. The bobs and the lamp over them: polished steel under a cool lamp on a walnut table at 0, brass at 0.25 and copper at 0.5 under a warm lamp, sea-green glass beads on a pale lab bench at 0.75, opening into a rainbow down the row at 1. Each glass bead focuses a spot of its own colour into its shadow.
// Knob 2: Speed. The pace of time. At 2 a cycle takes 28 seconds and the longest pendulum swings 22 times in it, once every 1.27 seconds; at 0.2 it all runs ten times slower, at 3 half as fast again.
// Knob 3: Pendulums. How many hang from the beam, 16 to 24, always filling the 128 rows. With more of them the bobs are smaller and the shortest swings 45 times a cycle against the longest's 22.
// Knob 4: Trails. A long exposure in the pendulums' own time: at 0.06 each bob drags a short streak, and turned up each one paints more of its arc in fading light, until at 1 the comets run together into a ladder of glowing bars with the bobs racing along them.
// Buttons: K1 tap catches every bob on the release board and lets them all go together, so the wave starts over from one straight line.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, floor, ceil, round, cos, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// The beam's centre line (it covers columns 30 and 31) and the swing.
const BX = 31;
const AMP = 22;
// One cycle at Speed 2, in seconds, and how many times the longest
// pendulum swings in it; each shorter one swings once more.
const TC = 28;
const N0 = 22;
// The lamp, off the left edge, and the beam's height over the table, in
// LEDs. The longest string is 13 LEDs, so its bob hangs 4 over the table.
const [LX, LY, LZ] = [-34, 58, 120];
const ZB = 17;
const L0 = 13;
const MAXN = 24;

function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}
function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v * (1 - s * max(0, min(k, 4 - k, 1)));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

// The lamp's colour, and the metal, at Finish 0, 1/4, 1/2 and 3/4 and on.
const LAMPS = [
  [184, 206, 248],
  [255, 214, 160],
  [255, 192, 142],
  [238, 236, 226],
  [238, 236, 226],
];
const METALS = [
  [196, 208, 226],
  [236, 172, 72],
  [240, 122, 74],
  [240, 122, 74],
  [240, 122, 74],
];
const stop = (T, f) => {
  const u = cl(f, 0, 1) * 4, i = min(3, floor(u));
  return T[i].map((v, c) => mix(v, T[i + 1][c], u - i));
};

// The table: walnut boards running along the beam, and a pale epoxy bench.
// The lamp's pool on it never moves, so it is worked out once.
function build(P) {
  const seams = [11, 37, 58];
  const ax = 14 - LX, ay = 62 - LY, az = -LZ, al = sqrt(ax * ax + ay * ay + az * az);
  let top = 0;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6;
    let pk = 0;
    for (const s of seams) if (x >= s) pk++;
    const sx = x + pk * 17.3, warp = 2.2 * vn(sx * 0.12, y * 0.018 + pk * 7);
    const grain = vn(sx * 0.62 + warp, y * 0.04 + pk * 13), fine = vn(sx * 1.9, y * 0.22 + pk * 5);
    const k = (0.74 + 0.36 * grain + 0.12 * fine) * (seams.includes(x) ? 0.6 : 1) * (0.88 + 0.24 * hash(pk, 99));
    P.wood[i * 3] = 0.76 * k;
    P.wood[i * 3 + 1] = 0.37 * k;
    P.wood[i * 3 + 2] = 0.16 * k;
    const b = 0.95 + 0.05 * hash(x, y + 300) + 0.05 * vn(x * 0.25, y * 0.25);
    P.bench[i * 3] = 0.8 * b;
    P.bench[i * 3 + 1] = 0.84 * b;
    P.bench[i * 3 + 2] = 0.8 * b;
    // Inverse square and the floor's slant, inside the shade's cone.
    const vx = x + 0.5 - LX, vy = y + 0.5 - LY, d = sqrt(vx * vx + vy * vy + LZ * LZ);
    const ca = (vx * ax + vy * ay + LZ * -az) / (d * al);
    const p = (LZ / d) ** 3 * (0.25 + 0.75 * sm(0.83, 0.97, ca));
    P.pool[i] = p;
    top = max(top, p);
    // The beam's shadow: it lies level, so its shadow is a straight band.
    const bx = LX + (BX - LX) * (LZ / (LZ - ZB)), hw = LZ / (LZ - ZB);
    P.beamD[i] = 0.5 * (1 - sm(hw - 0.9, hw + 0.9, Math.abs(x + 0.5 - bx)));
  }
  for (let i = 0; i < N; i++) P.pool[i] /= top;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    wood: F(N * 3), bench: F(N * 3), pool: F(N), beamD: F(N), D: F(N), tr: F(N * 3), f: F(N * 3),
    x: F(MAXN), prev: F(MAXN), from: F(MAXN), y: F(MAXN), z: F(MAXN), r: F(MAXN),
    c: 0, n: 0, hold: 0.3, board: 1, fin: 0, tau: 0.05, first: true,
  };
  params.s.from.fill(BX + AMP);
  build(params.s);
}

// Where each pendulum hangs, how high its bob is and how big it looks.
function layout(P, n) {
  P.n = n;
  const s = H / n, rb = min(2.35, 0.31 * s);
  for (let i = 0; i < MAXN; i++) {
    P.y[i] = floor(s / 2 + s * i) + 0.5;
    // A string's length goes as the square of its period.
    P.z[i] = ZB - L0 * (N0 / (N0 + i)) ** 2;
    P.r[i] = rb * (0.93 + 0.022 * P.z[i]);
  }
}

// The colours the finish gives the lamp and each bob.
function colours(P) {
  const f = P.fin, n = P.n;
  P.lamp = stop(LAMPS, f);
  P.glass = sm(0.52, 0.74, f);
  P.benchK = sm(0.5, 0.74, f);
  // Brass and copper tint their own highlights; steel and glass do not.
  P.tint = (0.15 + 0.7 * sm(0, 0.25, f)) * (1 - P.glass);
  const m = stop(METALS, f), u = sm(0.75, 1, f);
  P.col = [];
  // Sea-green glass at 3/4, opening into a rainbow down the row at 1.
  for (let i = 0; i < n; i++) {
    const b = hsv(mix(0.42, 0.02 + (0.8 * i) / (n - 1), u), 0.82, 1);
    P.col.push(m.map((v, c) => mix(v, b[c], P.glass)));
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const real = cl(dt || 0, 0, 0.1), d = (real * cl(k[1], 0.2, 3)) / 2;
  P.fin = cl(k[0], 0, 1);
  P.tau = 0.05 + 0.3 * cl(k[3], 0, 1) ** 1.6;
  const n = cl(round(k[2]), 16, 24);
  if (n !== P.n) layout(P, n);
  colours(P);

  // The button: a board comes in, every bob is caught against it, and all
  // are let go at once.
  if (input.btnPressed && input.btnPressed[0] && P.hold < 0) {
    P.hold = 0;
    P.from.set(P.x);
  }
  if (P.hold >= 0) {
    P.hold += real;
    const e = sm(0.05, 0.6, P.hold);
    for (let i = 0; i < MAXN; i++) P.x[i] = mix(P.from[i], BX + AMP, e);
    P.board = sm(0, 0.35, P.hold);
    if (P.hold >= 0.95) (P.hold = -1), (P.c = 0);
  } else {
    P.c = (P.c + d) % TC;
    for (let i = 0; i < MAXN; i++) P.x[i] = BX + AMP * cos((2 * PI * (N0 + i) * P.c) / TC);
    P.board = max(0, P.board - real * 5);
  }
  if (P.first) (P.first = false), P.prev.set(P.x);

  // The long exposure fades in the pendulums' own time, so a trail is as
  // long on the table at any speed. Each bob paints the way it came this
  // frame, older parts dimmer.
  const tr = P.tr, fade = exp(-d / P.tau), span = max(d, 0.004);
  for (let i = 0; i < tr.length; i++) tr[i] *= fade;
  for (let i = 0; i < n; i++) {
    const x0 = P.prev[i], x1 = P.x[i], y = P.y[i], rt = P.r[i] * 0.8, steps = max(1, ceil(Math.abs(x1 - x0) / 0.6));
    const col = P.col[i].map((v, c) => (v * 0.55 + P.lamp[c] * 0.25) * 0.85);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, xs = mix(x0, x1, t), lev = exp((-(1 - t) * span) / P.tau);
      for (let yy = floor(y - rt - 1); yy <= y + rt + 1; yy++)
        for (let xx = floor(xs - rt - 1); xx <= xs + rt + 1; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const dx = xx + 0.5 - xs, dy = yy + 0.5 - y, q = (dx * dx + dy * dy) / (rt * rt);
          if (q >= 1.6) continue;
          const a = lev * exp(-1.6 * q), o = (yy * W + xx) * 3;
          for (let c = 0; c < 3; c++) tr[o + c] = max(tr[o + c], col[c] * a);
        }
    }
  }
  P.prev.set(P.x);
}

// Where the lamp throws a point at height z onto the table.
const proj = (x, y, z) => {
  const k = LZ / (LZ - z);
  return [LX + (x - LX) * k, LY + (y - LY) * k];
};

// A shiny ball, sampled two by two inside each LED.
function ball(F, cx, cy, cz, r, base, lamp, g, tint) {
  const sc = lamp.map((v, c) => v * mix(1, (base[c] / 255) * 1.15, tint));
  // The light leans twice as far as the lamp really stands, so the glint
  // sits clearly on the lamp's side of a ball five LEDs across.
  let lx = 2 * (LX - cx), ly = 2 * (LY - cy), lz = LZ - cz;
  const ll = sqrt(lx * lx + ly * ly + lz * lz);
  (lx /= ll), (ly /= ll), (lz /= ll);
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = sqrt(hx * hx + hy * hy + hz * hz);
  (hx /= hl), (hy /= hl), (hz /= hl);
  const lxy = sqrt(lx * lx + ly * ly) || 1;
  const col = [0, 0, 0];
  for (let y = floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      let cov = 0;
      col[0] = col[1] = col[2] = 0;
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++) {
          const dx = (x + 0.25 + 0.5 * sx - cx) / r, dy = (y + 0.25 + 0.5 * sy - cy) / r, q = dx * dx + dy * dy;
          if (q >= 1) continue;
          cov += 0.25;
          const nz = sqrt(1 - q), diff = max(0, dx * lx + dy * ly + nz * lz), nh = max(0, dx * hx + dy * hy + nz * hz), spec = nh ** 18, sheen = nh ** 3;
          // Metal: the lamp's side lit, the rim holding the dark table.
          const rim = 0.4 + 0.6 * nz, back = max(0, -(dx * lx + dy * ly) / lxy) * sqrt(q);
          for (let c = 0; c < 3; c++) {
            const m = base[c] * (0.1 + 0.85 * diff * sqrt(diff)) * rim, gl = base[c] * (0.3 + 0.25 * diff + 0.9 * back);
            col[c] += (mix(m, gl, g) + sc[c] * (spec * 1.6 + 0.12 * sheen)) * 0.25;
          }
        }
      if (cov <= 0) continue;
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) F[o + c] = F[o + c] * (1 - cov) + col[c];
    }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.n) return;
  const F = P.f, D = P.D, n = P.n, lamp = P.lamp, g = P.glass, bk = P.benchK;

  // Shadows on the table: the beam, each string and each bob. A bob higher
  // up throws its shadow further from the lamp and softer.
  D.set(P.beamD);
  const sh = [];
  for (let i = 0; i < n; i++) {
    const [sx, sy] = proj(P.x[i], P.y[i], P.z[i]), [px, py] = proj(BX, P.y[i], ZB);
    sh.push([sx, sy]);
    const rs = P.r[i] * 0.95, pen = 0.45 + 0.09 * P.z[i], dk = (0.9 - 0.02 * P.z[i]) * (1 - 0.15 * g);
    for (let y = floor(sy - rs - pen - 1); y <= sy + rs + pen + 1; y++)
      for (let x = floor(sx - rs - pen - 1); x <= sx + rs + pen + 1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const dd = sqrt((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2), v = dk * (1 - sm(rs - pen, rs + pen, dd)), j = y * W + x;
        if (v > D[j]) D[j] = v;
      }
    const len = sqrt((sx - px) ** 2 + (sy - py) ** 2), m = ceil(len * 1.5);
    for (let s = 0; s <= m; s++) {
      const t = s / max(1, m), x = floor(mix(px, sx, t)), y = floor(mix(py, sy, t));
      if (x >= 0 && x < W && y >= 0 && y < H && D[y * W + x] < 0.2) D[y * W + x] = 0.2;
    }
  }

  // The table under the lamp.
  const fl = 0.42;
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const e = (0.1 + 0.9 * P.pool[i] * (1 - D[i])) * fl;
    for (let c = 0; c < 3; c++) F[o + c] = mix(P.wood[o + c], P.bench[o + c], bk) * lamp[c] * e + P.tr[o + c];
  }
  // A glass bead gathers the lamp into a spot of its colour in its shadow.
  if (g > 0.01)
    for (let i = 0; i < n; i++) {
      const [sx, sy] = sh[i], rc = P.r[i] * 0.55, col = P.col[i];
      for (let y = floor(sy - 3); y <= sy + 3; y++)
        for (let x = floor(sx - 3); x <= sx + 3; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const q = ((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2) / (rc * rc), a = g * 0.75 * exp(-q) * (0.4 + 0.6 * P.pool[y * W + x]), o = (y * W + x) * 3;
          for (let c = 0; c < 3; c++) F[o + c] += col[c] * a;
        }
    }

  // Strings: a fine line from the beam out to each bob, catching the lamp.
  for (let i = 0; i < n; i++) {
    const x1 = P.x[i], y = floor(P.y[i]), a0 = min(BX, x1), a1 = max(BX, x1);
    for (let x = floor(a0); x < a1; x++) {
      if (x < 0 || x >= W) continue;
      const o = (y * W + x) * 3, a = 0.5 * cl(min(x + 1 - a0, a1 - x), 0, 1);
      for (let c = 0; c < 3; c++) F[o + c] = mix(F[o + c], lamp[c] * 0.5, a);
    }
  }
  // The bobs, the higher ones last.
  for (let i = 0; i < n; i++) ball(F, P.x[i], P.y[i], P.z[i], P.r[i], P.col[i], lamp, g, P.tint);

  // The release board, a strip of pale wood that holds the row straight.
  if (P.board > 0.01) {
    const bx = BX + AMP + 3.2;
    for (let y = 0; y < H; y++)
      for (let x = floor(bx); x < bx + 2 && x < W; x++) {
        const o = (y * W + x) * 3, v = x === floor(bx) ? 0.85 : 0.55;
        for (let c = 0; c < 3; c++) F[o + c] = mix(F[o + c], [224, 186, 132][c] * (lamp[c] / 255) * v, P.board);
      }
  }

  // The beam over everything: brushed metal, its lamp side bright, with a
  // clamp at every pivot.
  for (let y = 0; y < H; y++) {
    const grain = 0.92 + 0.08 * hash(y, 7);
    for (let x = BX - 1; x <= BX; x++) {
      const o = (y * W + x) * 3, v = (x < BX ? 0.5 : 0.24) * grain;
      for (let c = 0; c < 3; c++) F[o + c] = lamp[c] * v;
    }
  }
  for (let i = 0; i < n; i++) {
    const y = floor(P.y[i]);
    for (let x = BX - 1; x <= BX; x++) {
      const o = (y * W + x) * 3, v = x < BX ? 0.78 : 0.4;
      for (let c = 0; c < 3; c++) F[o + c] = lamp[c] * v;
    }
  }

  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
