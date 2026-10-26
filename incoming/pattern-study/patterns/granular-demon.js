// ===== Patternflow pattern =====
// Title:   Granular Demon
// Family:  particle
// Idea:    Grains on a shaken floor fly between tall boxes through a window in each wall, and since a crowded box loses its energy in collisions and stops sending grains up to the window while a sparse one keeps throwing them over, one box fills with a cold heap lying low and the others keep a few hot grains flying to the lid, until the walls slide up, the grains spread out and the next run picks its box.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Maxwell's demon in a vibrated granular gas (Holger Schlichting and Volker Nordmark, 1996), the flux model F(n) = n^2 exp(-B n^2) (Jens Eggers, 1999), the sudden collapse of a granular cluster in several compartments (Devaraj van der Meer, Ko van der Weele and Detlef Lohse, 2002), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shaking=130..260, Boxes=2..5
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 a cold box and its slow grains are azure, a hot box pink and the fast grains paler pink, violet between; at 0.5 cold is rose and hot is blue. The scale runs the other way round when it would cross the orange to lime gap, which reads brown when dim.
// Knob 2: Speed. 2 runs the simulation in real time, gravity 300 LEDs a second squared, so a grain leaving the floor at 275 LEDs a second just reaches the lid; 0.2 is ten times slower and 3 half as fast again. A run ends once one box has held 85% of the 240 grains, or the windows have stayed quiet, for 8 seconds, or at 45 seconds; then the walls slide up for 3 seconds while the floor shakes at 300, slide back down, and the shaking eases to the knob's over 1.5 seconds.
// Knob 3: Shaking. The floor's speed U, 130 to 260 LEDs a second: a grain falling onto it at v leaves at U + 0.7 (U + v). At 130 two boxes split about 10 seconds into a run and the fuller one keeps 97.7% of the grains (Eggers's flux model, fitted to this floor, says 97.9%); at 150, 92.7% (93.0%); from about 170 the even split holds. More boxes cluster under harder shaking, with a sudden collapse into one box after a long even spell: three boxes up to 160, four up to 200, five up to 230, and five at 130 freeze with the grains in two boxes until the reset.
// Knob 4: Boxes. 2 to 5 boxes across the 64 columns, the walls one LED thick at k x 64 / n, each with a window 40 rows tall from 50 to 90 LEDs above the floor. A new count deals the grains out evenly again.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, log, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The demon is the grains themselves. A box of grains at temperature T
// holds them in a barometric layer of height T / g, and collisions, each
// losing 1 - 0.85^2 = 28% of the energy along the line of centres, cool it
// faster the more grains it has. So the flux F(n) out through a window
// first rises with n and then falls: Eggers wrote F(n) = A n^2 exp(-B n^2),
// and an even split of N grains between two boxes is unstable once
// B N^2 > 4. Measured here with the window turned into a counting mirror,
// F(n) peaks near n = 80 when the floor moves at 130 (a fit gives B N^2 =
// 8.1 for N = 240) and near n = 160 when it moves at 260 (2.8).

// Lengths are in LEDs, time in seconds of the simulation. z counts up from
// the floor, the bottom edge of row 125, to the lid, the top edge of row 0.
const ZTOP = 126;
const N = 240, RAD = 0.5, DIA = 1;
const GRAV = 300;
// Restitution: grain on grain, grain on the floor, grain on a wall or lid.
const E_GG = 0.85, E_FL = 0.7, E_WL = 0.9;
// Substep and a speed cap, so no grain moves more than 0.86 LED a substep.
const SUB = 1 / 650, VMAX = 560;
// The window in every inner wall, from its sill to its lintel.
const ZW0 = 50, ZW1 = 90;
// A bounce off the rough floor turns up to 30% of its speed sideways.
const ROUGH = 0.3;
// The Shaking knob's range and the shaking of a reset, all floor speeds.
const U_LO = 130, U_HI = 260, U_RESET = 300;
// The reset, in seconds: the walls slide up, stay up, slide down, and the
// shaking eases back to the knob.
const LIFT = 0.6, OPEN = 2.4, EASE = 1.5;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The knob turns hues on a wheel that skips orange through lime, which
// reads brown and olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

export function setup(params) {
  params.s = {
    nb: 0, phase: 1, pt: 0, run: 0, held: 0, hue: 0, shake: 0, zb: 0,
    x: new Float32Array(N), z: new Float32Array(N), vx: new Float32Array(N), vz: new Float32Array(N),
    ox: new Float32Array(N), oz: new Float32Array(N),
    head: new Int32Array(W * (ZTOP + 2)), next: new Int32Array(N),
    count: new Int32Array(5), nsm: new Float32Array(5), temp: new Float32Array(5),
    cross: new Float32Array(4), flux: new Float32Array(4),
    rgb: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
}

// A fresh start: the grains dealt out evenly, nb of them to a round, at
// random spots in the lower half of their boxes.
function start(S, nb) {
  S.nb = nb;
  S.walls = [];
  for (let k = 1; k < nb; k++) S.walls.push((W * k) / nb);
  for (let i = 0; i < N; i++) {
    const b = i % nb, x0 = (W * b) / nb + (b ? 1 : RAD), x1 = (W * (b + 1)) / nb - (b < nb - 1 ? 1 : RAD);
    S.x[i] = x0 + Math.random() * (x1 - x0);
    S.z[i] = RAD + Math.random() * 60;
    S.vx[i] = (Math.random() - 0.5) * 60;
    S.vz[i] = (Math.random() - 0.5) * 60;
  }
  S.temp.fill(8000);
  S.nsm.fill(N / nb);
  S.flux.fill(0);
  S.phase = 1;
  S.run = 0;
  S.held = 0;
  S.zb = 0;
}

const boxOf = (S, x) => min(S.nb - 1, floor((x * S.nb) / W));

// One substep. The floor is a sawtooth driver in the limit of a small
// stroke: it stays at z = 0 and always meets a grain moving up at U, so a
// grain falling at v leaves at U + E_FL (U + v). Grains collide as hard
// disks one LED across with restitution E_GG, found through a grid of
// one-LED cells; overlaps are pushed apart along the line of centres.
function step(S, h, U) {
  const { x, z, vx, vz, head, next, walls } = S, zb = S.zb;
  for (let i = 0; i < N; i++) {
    const px = x[i], pz = z[i];
    vz[i] -= GRAV * h;
    let sp = vx[i] * vx[i] + vz[i] * vz[i];
    if (sp > VMAX * VMAX) {
      sp = VMAX / sqrt(sp);
      vx[i] *= sp;
      vz[i] *= sp;
    }
    x[i] += vx[i] * h;
    z[i] += vz[i] * h;
    if (z[i] < RAD) {
      z[i] = RAD;
      const s = U - vz[i];
      if (s > 0) {
        vz[i] = U + E_FL * s;
        vx[i] += (Math.random() - 0.5) * 2 * ROUGH * s;
      }
    } else if (z[i] > ZTOP - RAD) {
      z[i] = ZTOP - RAD;
      if (vz[i] > 0) vz[i] = -E_WL * vz[i];
    }
    if (x[i] < RAD) (x[i] = RAD), (vx[i] = abs(vx[i]) * E_WL);
    else if (x[i] > W - RAD) (x[i] = W - RAD), (vx[i] = -abs(vx[i]) * E_WL);
    // The inner walls, slabs one LED thick standing above zb (0 unless a
    // reset has lifted them). A grain may overlap a slab only below its
    // bottom edge or inside its window, its whole body between sill and
    // lintel.
    for (let k = 0; k < walls.length; k++) {
      const xk = walls[k];
      if (abs(x[i] - xk) >= RAD + 0.5) continue;
      const open = (zi) => zi + RAD <= zb || (zi - RAD >= ZW0 && zi + RAD <= ZW1);
      if (open(z[i])) {
        if (zb === 0 && (px - xk) * (x[i] - xk) < 0) S.cross[k] += 1;
        break;
      }
      if (zb === 0 && abs(px - xk) < RAD + 0.5 && open(pz)) {
        // Inside the window's tunnel: it hit the sill or the lintel.
        if (z[i] < ZW0 + RAD) (z[i] = ZW0 + RAD), (vz[i] = abs(vz[i]) * E_WL);
        else (z[i] = ZW1 - RAD), (vz[i] = -abs(vz[i]) * E_WL);
      } else {
        const side = px !== xk ? (px < xk ? -1 : 1) : x[i] < xk ? -1 : 1;
        x[i] = xk + side * (RAD + 0.5);
        if (vx[i] * side < 0) vx[i] = -vx[i] * E_WL;
      }
      break;
    }
  }
  head.fill(-1);
  for (let i = 0; i < N; i++) {
    const c = cl(floor(z[i]), 0, ZTOP + 1) * W + cl(floor(x[i]), 0, W - 1);
    next[i] = head[c];
    head[c] = i;
  }
  for (let i = 0; i < N; i++) {
    const cx = floor(x[i]), cz = floor(z[i]);
    for (let gz = max(0, cz - 1); gz <= min(ZTOP + 1, cz + 1); gz++)
      for (let gx = max(0, cx - 1); gx <= min(W - 1, cx + 1); gx++)
        for (let j = head[gz * W + gx]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const dx = x[j] - x[i], dz = z[j] - z[i], d2 = dx * dx + dz * dz;
          if (d2 >= DIA * DIA || d2 < 1e-9) continue;
          const d = sqrt(d2), nx = dx / d, nz = dz / d;
          const vn = (vx[j] - vx[i]) * nx + (vz[j] - vz[i]) * nz;
          if (vn < 0) {
            const J = (-(1 + E_GG) * vn) / 2;
            vx[i] -= J * nx;
            vz[i] -= J * nz;
            vx[j] += J * nx;
            vz[j] += J * nz;
          }
          const o = (DIA - d) / 2;
          x[i] -= o * nx;
          z[i] -= o * nz;
          x[j] += o * nx;
          z[j] += o * nz;
        }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, U_LO, 2], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), knobU = cl(kv[2], U_LO, U_HI), nb = round(cl(kv[3], 2, 5));
  if (nb !== S.nb) start(S, nb);
  const g = (d * speed) / 2;
  // Phase 1 runs at the knob's shaking. Phase 0 is the reset: the walls
  // slide up and the floor shakes at U_RESET, which spreads a heap that
  // stronger shaking alone cannot lift over a window 50 LEDs up; then the
  // walls slide back down and the shaking eases to the knob.
  let level = 0;
  if (S.phase === 0) {
    S.pt += g;
    const t = S.pt, up = LIFT + OPEN;
    S.zb = t < LIFT ? (ZTOP + 1) * (t / LIFT) : t < up ? ZTOP + 1 : t < up + LIFT ? (ZTOP + 1) * (1 - (t - up) / LIFT) : 0;
    level = t < up + LIFT ? 1 : max(0, 1 - (t - up - LIFT) / EASE);
    if (t >= up + LIFT + EASE) (S.phase = 1), (S.run = 0), (S.held = 0), (S.zb = 0);
  } else S.run += g;
  S.shake = knobU + (U_RESET - knobU) * level;
  S.ox.set(S.x);
  S.oz.set(S.z);
  const n = max(1, ceil(g / SUB - 1e-6));
  for (let k = 0; k < n; k++) step(S, g / n, S.shake);
  const cnt = S.count;
  cnt.fill(0);
  const tsum = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const b = boxOf(S, S.x[i]);
    cnt[b]++;
    tsum[b] += (S.vx[i] * S.vx[i] + S.vz[i] * S.vz[i]) / 2;
  }
  // Each box's granular temperature, the mean kinetic energy a grain,
  // smoothed over 0.6 s; an empty box keeps the last value it had.
  const a = 1 - exp(-g / 0.6);
  for (let b = 0; b < S.nb; b++) {
    if (cnt[b]) S.temp[b] += a * (tsum[b] / cnt[b] - S.temp[b]);
    S.nsm[b] += a * (cnt[b] - S.nsm[b]);
  }
  // Crossings through each window a second, smoothed over 0.4 s.
  const af = 1 - exp(-g / 0.4);
  let moved = 0;
  for (let k = 0; k < S.nb - 1; k++) {
    S.flux[k] += af * (S.cross[k] / max(1e-6, g) - S.flux[k]);
    S.cross[k] = 0;
    moved += S.flux[k];
  }
  // A run ends once one box has held 85% of the grains, or the windows
  // have stayed quiet, for 8 s, or after 45 s.
  if (S.phase === 1) {
    let top = 0;
    for (let b = 0; b < S.nb; b++) top = max(top, cnt[b]);
    S.held = top >= 0.85 * N || moved < 0.3 ? S.held + g : 0;
    if (S.held > 8 || S.run > 45) (S.phase = 0), (S.pt = 0);
  }
}

// Colours: a cold box or grain is azure at knob 0 and a hot one pink, on
// log T from 3,000 to 40,000 (LEDs per second, squared). The scale runs
// SPAN round the knob's wheel from the cold hue, back the other way when
// it would run past the wheel's end, so it never jumps across the gap.
const P_COLD = 0.43, SPAN = 0.43;
const heatOf = (T) => cl(log(max(1, T) / 3000) / log(40000 / 3000), 0, 1);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.nb) return;
  const rgb = S.rgb, c = S.c, hue = S.hue;
  const pc = P_COLD + hue - floor(P_COLD + hue), span = pc + SPAN < 1 ? SPAN : -SPAN;
  const tint = (heat) => wheel(pc + span * heat);
  rgb.fill(0);
  const add = (x, y, col, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    rgb[o] += col[0] * a;
    rgb[o + 1] += col[1] * a;
    rgb[o + 2] += col[2] * a;
  };
  // Each box glows in the colour of its temperature T, fading upward as
  // the square root of the barometric profile exp(-g z / T): two scale
  // heights T / g to fall by 1/e, short over a cold heap, the whole box
  // over a hot gas. A box with no grains has no gas, and its glow fades
  // below two grains.
  for (let b = 0; b < S.nb; b++) {
    const T = max(50, S.temp[b]);
    hsv(tint(heatOf(T)), 0.85, 1, c);
    const amp = 0.42 * min(1, S.nsm[b] / 2);
    const x0 = b ? floor((W * b) / S.nb) + 1 : 0, x1 = b < S.nb - 1 ? floor((W * (b + 1)) / S.nb) : W;
    for (let y = 0; y < ZTOP; y++) {
      const v = amp * exp((-GRAV * (ZTOP - y - 0.5)) / (2 * T));
      for (let x = x0; x < x1; x++) add(x, y, c, v);
    }
  }
  // The walls above their bottom edge, and the sill and lintel of each
  // window, which flare with the grains passing through it.
  const wall = [0.55, 0.6, 0.75], lip = [1, 1, 1];
  const rs = floor(ZTOP - ZW0), rl = floor(ZTOP - ZW1) - 1, yb = ZTOP - S.zb;
  S.walls.forEach((xk, k) => {
    const col = floor(xk);
    for (let y = 0; y < yb; y++) if (y <= rl || y >= rs) add(col, y, wall, 0.4);
    if (rs < yb) {
      const f = 0.25 + 0.6 * min(1, S.flux[k] / 30);
      for (let dx = -1; dx <= 1; dx++) {
        add(col + dx, rs, lip, dx ? f * 0.6 : f);
        add(col + dx, rl, lip, dx ? f * 0.6 : f);
      }
    }
  });
  // The floor, brighter the harder it shakes.
  const fl = [0.85, 0.85, 0.95];
  for (let y = ZTOP; y < H; y++) for (let x = 0; x < W; x++) add(x, y, fl, 0.2 + 0.4 * min(1, S.shake / U_HI));
  // Grains, coloured by their own kinetic energy on the boxes' scale and
  // paler the faster, each a streak from where it was a frame ago with a
  // faint halo round its head, so a crowd of grains reads as a heap.
  for (let i = 0; i < N; i++) {
    const ke = (S.vx[i] * S.vx[i] + S.vz[i] * S.vz[i]) / 2, heat = heatOf(ke);
    hsv(tint(heat), 0.7 - 0.45 * heat, 0.75 + 0.25 * heat, c);
    const x1 = S.x[i], z1 = S.z[i], x0 = S.ox[i], z0 = S.oz[i];
    const m = min(12, ceil(max(abs(x1 - x0), abs(z1 - z0))));
    for (let e = m - 1; e >= 0; e--) {
      const f = e / m;
      add(floor(x0 + (x1 - x0) * f), floor(ZTOP - (z0 + (z1 - z0) * f)), c, 0.1 + 0.3 * f);
    }
    const hx = floor(x1), hy = floor(ZTOP - z1);
    add(hx, hy, c, 0.95);
    add(hx - 1, hy, c, 0.13);
    add(hx + 1, hy, c, 0.13);
    add(hx, hy - 1, c, 0.13);
    add(hx, hy + 1, c, 0.13);
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
