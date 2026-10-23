// ===== Patternflow pattern =====
// Title:   Pancakes
// Family:  kitchen
// Idea:    A seasoned griddle seen from above: batter is ladled into rounds, bubbles rise and pop and leave holes as the tops set, a turner flips each one to its fried side and slides the done ones onto a stack on the plate, while butter melts and oil glints on the iron.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the flat-top griddles of diner breakfast counters
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Batter=0..1, Speed=0.2..3, Pancakes=6..12, Heat=0..1
//
// Knob 1: Batter. Buttermilk at 0, then blueberry, buckwheat and cocoa at 1; the bowl changes at once and the next rounds are poured from it.
// Knob 2: Speed. How fast the cook works: at 2 a pancake takes about 20 s from the ladle to the plate, and the turner flips or serves one every two seconds.
// Knob 3: Pancakes. How many rounds are on the iron: six big ones at 6, twelve silver dollars at 12, and still one turner for all of them.
// Knob 4: Heat. How hot the griddle runs. At the low end the pancakes come out golden; turned up they cook faster, bubble more, fry dark brown and the oil starts to smoke.
// Buttons: K1 tap sends the turner to the pancake furthest along, to flip it or serve it now.

const [W, H] = [64, 128];
const N = W * H;
// Rows: the iron IR0..IR1, the grease trough, the butcher block from CT.
const [IR0, IR1, CT] = [3, 90, 94];
const [PX, PY, PR, BX, BY, BR] = [42, 112, 16.5, 7, 114, 12.5];
const [EMPTY, POUR, SIDE1, FLIP, SIDE2, SERVE] = [0, 1, 2, 3, 4, 5];
// Pancakes to a full plate; how long the turner takes to get anywhere.
const [FULL, GO] = [7, 0.3];
const { min, max, floor, round, ceil, sin, cos, abs, hypot, exp, atan2, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = sm(x - xi), v = sm(y - yi), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + hash(xi + 1, yi + 1)) * u * v;
}

// Each batter: the wet top, the set top, the inside a popped bubble shows,
// and the fried side from pale through golden to dark.
const BAT = [
  [[228, 212, 166], [222, 196, 142], [64, 38, 18], [232, 194, 124], [206, 138, 66], [118, 60, 24]],
  [[226, 212, 172], [218, 196, 148], [62, 38, 22], [228, 190, 126], [202, 134, 68], [114, 58, 26]],
  [[196, 170, 142], [182, 152, 120], [52, 34, 24], [188, 148, 108], [150, 98, 58], [84, 46, 28]],
  [[140, 92, 64], [124, 80, 54], [40, 24, 16], [130, 82, 54], [100, 58, 36], [68, 36, 22]],
];
// A blueberry's skin, raw and baked.
const BERRY = [[64, 40, 118], [50, 28, 70]];
const C = [0, 0, 0];
function fry(bt, b) {
  b = cl(b, 0, 1);
  const lo = b < 0.5, a = lo ? bt[3] : bt[4], c = lo ? bt[4] : bt[5], t = lo ? b * 2 : b * 2 - 1;
  for (let i = 0; i < 3; i++) C[i] = a[i] + (c[i] - a[i]) * t;
}

let B;
const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? -1 : (y * W + x) * 3);
function put(x, y, r, g, b, o = at(x, y)) {
  if (o >= 0) (B[o] = r), (B[o + 1] = g), (B[o + 2] = b);
}
function blend(x, y, r, g, b, a, o = at(x, y)) {
  if (o >= 0) (B[o] += (r - B[o]) * a), (B[o + 1] += (g - B[o + 1]) * a), (B[o + 2] += (b - B[o + 2]) * a);
}
function dim(x, y, k, o = at(x, y)) {
  if (o >= 0) (B[o] *= k), (B[o + 1] *= k), (B[o + 2] *= k);
}

// Marks that should read sharp (holes, flecks, pores, glints) sit on the
// squares the grain in show() pushes their way: dark ones where x + y is
// even, bright ones where it is odd. Two such squares never touch side by side.
function build(P) {
  const bg = P.bg, mk = new Uint8Array(N);
  const set = (p, r, g, b) => ((bg[p * 3] = r), (bg[p * 3 + 1] = g), (bg[p * 3 + 2] = b));
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, odd = (x + y) & 1;
    let k;
    P.G[p] = hash(x + 77, y + 5) < 0.5 ? 0.94 : 1.06;
    if (y < IR0) (k = 0.82 + 0.08 * vn(x * 0.3, y)), set(p, 170 * k, 172 * k, 178 * k);
    else if (y <= IR1) {
      // Seasoning in bronze patches, and crumbs of old batter.
      const s = vn(x * 0.08, y * 0.06) * 0.6 + vn(x * 0.21 + 9, y * 0.19) * 0.4;
      k = 0.84 + 0.32 * s;
      if (odd && rnd() < 0.024) set(p, 196, 140, 70), (mk[p] = 1);
      else set(p, (52 + 10 * s) * k, 44 * k, 39 * k);
    } else if (y === IR1 + 1) (k = 0.92 + 0.06 * vn(x * 0.5, 1)), set(p, 200 * k, 200 * k, 204 * k);
    else if (y === IR1 + 2) (k = 0.85 + 0.2 * vn(x * 0.25, 3)), set(p, 96 * k, 64 * k, 26 * k);
    else if (y < CT) set(p, 180, 180, 186);
    else {
      // Oak strips seven LEDs wide, told apart by hue more than by light,
      // with dark pores along the grain.
      const s = floor((x + 2) / 7), t = hash(s, 5);
      const v = vn(x * 0.4 + s * 13, y * 0.09);
      k = !odd && rnd() < 0.12 ? 0.27 : 1;
      set(p, (176 + 4 * v) * k, (100 + 26 * t + 20 * v) * k, (56 + 20 * t + 14 * v) * k);
    }
  }
  // The hood lights' reflection, and oil specks catching it.
  for (let p = IR0 * W; p <= IR1 * W + 63; p++) {
    const x = p & 63, y = p >> 6;
    P.sheen[p] = exp(-(((x - 20) / 17) ** 2) - ((y - 30) / 11) ** 2) + 0.8 * exp(-(((x - 44) / 15) ** 2) - ((y - 68) / 12) ** 2);
  }
  P.glint = [];
  for (let p = (IR0 + 1) * W; p < IR1 * W; p++) if (!mk[p] && (p + (p >> 6)) & 1 && rnd() < 0.12) P.glint.push(p, rnd() * 7, 1.5 + rnd() * 3);
  // A white enamel bowl with a navy rolled rim; its batter follows K1.
  P.bowl = [];
  for (let y = BY - 16; y < H; y++)
    for (let x = 0; x <= BX + 16; x++) {
      const p = y * W + x, dx = x - BX, dy = y - BY, d = hypot(dx, dy);
      let k;
      if (d > BR + 3) continue;
      if (d > BR) dx + dy > 0 && ((k = 0.9 + 0.033 * (d - BR)), set(p, bg[p * 3] * k, bg[p * 3 + 1] * k, bg[p * 3 + 2] * k));
      else if (d > BR - 1.6) (k = 0.85 + 0.2 * cos(atan2(dy, dx) + 2.3)), set(p, 26 * k, 38 * k, 88 * k);
      else P.bowl.push(p, !((x + y) & 1) && hash(x + 3, y) < 0.12 ? -1 : 0.97 - 0.08 * sm((d - BR + 7) / 5));
    }
  // Charcoal stoneware: a raised rim that catches the light, the well, cream
  // flecks in the glaze, and its shadow on the wood (a negative entry).
  P.plate = [];
  for (let dy = -20; dy <= 20; dy++)
    for (let dx = -20; dx <= 20; dx++) {
      const d = hypot(dx, dy), k = mix(0.86, 0.98 + 0.1 * cos(atan2(dy, dx) + 2.4), cl((d - PR + 6.5) / 4, 0, 1));
      if (d > PR + 3 || (d > PR && dx + dy <= 0)) continue;
      if (d > PR) P.plate.push(dx, dy, -0.9 - 0.033 * (d - PR), 0, 0);
      else if ((dx + dy) & 1 && hash(dx + 40, dy + 40) < 0.1) P.plate.push(dx, dy, 206, 198, 178);
      else P.plate.push(dx, dy, 66 * k, 72 * k, 86 * k);
    }
}

function layout(P, n) {
  const cols = n <= 8 ? 2 : 3, rows = ceil(n / cols), cw = W / cols, ch = (IR1 - IR0 - 1) / rows, R = min(cw, ch) / 2 - 1.6;
  if (P.carry) P.stack.push(P.carry), (P.carry = null);
  P.n = n;
  P.slots = Array.from({ length: n }, (_, i) => {
    const x = round(((i % cols) + 0.5) * cw + (rnd() - 0.5) * 2), y = round(IR0 + 1 + (floor(i / cols) + 0.5) * ch + (rnd() - 0.5) * 2);
    return { x, y: y + ((x + y) & 1), R, st: EMPTY, t: rnd(), melt: 0.8 + rnd() * 0.6, p: 0, cake: null };
  });
  P.sp.job = P.ld.job = null;
}

// A fresh round: its wobbly outline, the shine, where bubbles will come up,
// the flecks the iron leaves on the fried side, berries.
function newCake(P, s) {
  const R = s.R, h = ceil(R * 1.08) + 1, sz = 2 * h + 1, n = sz * sz, F = () => new Float32Array(n);
  const k = { bi: P.bi, R, h, sz, b: 0, ox: 0, oy: 0, S1: P.S1 * (0.55 + (0.45 * R) / 12.7), dd: F(), site: F(), mot: F(), hl: F(), spk: new Uint8Array(n) };
  const [a1, a2, m0, dens] = [rnd() * 7, rnd() * 7, rnd() * 50, 0.6 + 0.25 * P.heat];
  for (let j = -h, q = 0; j <= h; j++)
    for (let i = -h; i <= h; i++, q++) {
      const a = atan2(j, i), d = (k.dd[q] = hypot(i, j) / (R * (1 + 0.035 * sin(3 * a + a1) + 0.025 * sin(5 * a + a2))));
      k.mot[q] = vn(i * 0.24 + m0, j * 0.24);
      k.hl[q] = 14 * exp(-((i / R + 0.3) ** 2 + (j / R + 0.38) ** 2) * 7);
      // Bubbles never touch even at the corners, so they never run into lines.
      const free = (m) => j === -h || (!m[q - sz - 1] && !m[q - sz + 1]);
      if ((i + j) & 1) continue;
      if (P.bi === 1 && rnd() < 0.07) k.spk[q] = 2;
      else {
        if (d < 0.97 && rnd() < dens && free(k.site)) k.site[q] = 0.12 + 0.88 * rnd() ** 0.6;
        if (rnd() < 0.85 * sm((k.mot[q] - 0.36) / 0.36)) k.spk[q] = 1;
      }
    }
  return k;
}

// One pancake at (cx, cy), raw top or fried side up, squashed to sy as it
// turns over and spread to rs while poured.
function cake(P, k, cx, cy, sx, sy, fried, p, rs = 1, lit = 1) {
  if (abs(sy) < 0.05) return;
  const bt = BAT[k.bi], [wet0, set0, hole] = bt, { h, sz, dd, site, spk, mot, hl, S1 } = k;
  const ex = h * abs(sx) + 1, ey = h * abs(sy) + 1, setR = 1.02 - 1.1 * p, rim = cl(p * 1.5, 0, 1);
  fry(bt, k.b);
  const [fr, fg, fb] = C;
  for (let y = max(0, floor(cy - ey)); y <= min(H - 1, ceil(cy + ey)); y++)
    for (let x = max(0, floor(cx - ex)); x <= min(W - 1, ceil(cx + ex)); x++) {
      const i = round((x - cx) / sx), j = round((y - cy) / sy);
      if (i < -h || i > h || j < -h || j > h) continue;
      const q = (j + h) * sz + i + h, d = dd[q] / rs;
      if (d > 1) continue;
      let r, g, b;
      if (!fried) {
        // Wet batter shines; it sets from the rim in, and the rim shows the
        // browning underneath.
        const wet = sm((setR - d) / 0.14 + 0.5), dome = 1.02 - 0.06 * d * d, gl = wet * hl[q], e = sm((d - 0.8) / 0.2) * rim;
        r = mix(mix(set0[0], wet0[0], wet) * dome + gl, fr, e);
        g = mix(mix(set0[1], wet0[1], wet) * dome + gl, fg, e);
        b = mix(mix(set0[2], wet0[2], wet) * dome + gl * 0.8, fb, e);
        const tb = site[q];
        if (tb && p > tb) {
          // A bubble shines for a moment and pops. Where the batter is still
          // wet the hole closes again; where it has set it stays open.
          const age = (p - tb) * S1;
          if (age < 0.3) (r = mix(r, 255, 0.5)), (g = mix(g, 250, 0.5)), (b = mix(b, 236, 0.5));
          else {
            const o = d < 1.02 - 1.1 * (tb + 0.3 / S1) ? 1 - cl((age - 0.3) / 0.5, 0, 1) : 1;
            (r = mix(r, hole[0], o)), (g = mix(g, hole[1], o)), (b = mix(b, hole[2], o));
          }
        }
      } else {
        // Browner in the middle, mottled, flecked, and pale round the edge.
        const f = spk[q] === 1, e = sm((d - 0.88) / 0.12), s = f ? 0.45 : 1;
        fry(bt, k.b * (1.12 - 0.42 * sm((d - 0.5) / 0.5)) * (0.86 + 0.28 * mot[q]) + (f ? 0.55 : 0));
        r = mix(C[0] * s, set0[0] * 0.9, e);
        g = mix(C[1] * s, set0[1] * 0.9, e);
        b = mix(C[2] * s, set0[2] * 0.9, e);
      }
      if (spk[q] === 2) [r, g, b] = BERRY[fried];
      put(x, y, r * lit, g * lit, b * lit);
    }
}

// A small offset that keeps a pancake's flecks on the grain's dark squares.
const jig = (o = floor(rnd() * 3) - 1) => [o, o ? (rnd() < 0.5 ? -1 : 1) : 0];

// Shadows fade over three LEDs so their edge stays soft under the grain.
function shadow(cx, cy, R, k) {
  for (let y = floor(cy - R - 2); y <= cy + R + 2; y++)
    for (let x = floor(cx - R - 2); x <= cx + R + 2; x++) {
      const e = sm((hypot(x - cx, y - cy) - R + 1.5) / 3);
      if (e < 1) dim(x, y, k + (1 - k) * e);
    }
}

export function setup(params) {
  const P = params, F = (n = N) => new Float32Array(n);
  Object.assign(P, { bg: F(N * 3), buf: F(N * 3), G: F(), sheen: F(), t: 0, n: 0, stack: [], carry: null, pat: -1, pdx: 0, pdy: 0, pst: 0, spat: [], steam: [] });
  [P.sp, P.ld] = [{ x: 70, y: 140, ph: 0, t: 0, idle: 0 }, { x: 11, y: 110, ph: 3, t: 0 }];
  build(P);
}

const brown = (P) => 0.36 + 0.5 * P.heat;

// Open on a morning under way: some on each side, a stack started, then the
// cook's clock runs on a while at the knob's speed.
function warm(P) {
  const S = [...P.slots].sort(() => rnd() - 0.5);
  S.forEach((s, i) => {
    const f = (i + 0.5) / S.length;
    if (f < 0.12) return;
    s.cake = newCake(P, s);
    if (f < 0.6) (s.st = SIDE1), (s.t = ((f - 0.12) / 0.48) * s.cake.S1 * 0.95);
    else (s.st = SIDE2), (s.t = (f - 0.6) * 9), (s.cake.b = brown(P));
  });
  for (let i = 0, n = 3 + floor(rnd() * 2); i < n; i++) {
    const k = newCake(P, { R: P.slots[0].R });
    [k.b, k.ox, k.oy] = [brown(P), ...jig()];
    P.stack.push(k);
  }
  for (let i = 0, n = round(6 * P.rate * 30); i < n; i++) step(P, 1 / 30);
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 6, 0.06];
  P.bi = round(cl(k[0], 0, 1) * 3);
  P.rate = cl(k[1], 0.2, 3) / 2;
  P.heat = cl(k[3], 0, 1);
  P.S1 = 8 / (0.7 + 0.8 * P.heat);
  const n = round(cl(k[2], 6, 12));
  if (n !== P.n) layout(P, n);
  if (!P.warm) (P.warm = true), warm(P);
  const go = input.btnPressed?.[0] && P.slots.filter((s) => s.st === SIDE1 || s.st === SIDE2).sort((a, b) => b.p - a.p)[0];
  if (go) go.rush = true;
  step(P, cl(dt, 0, 0.1) * P.rate);
}

const glide = (o, x, y, u) => ((o.x = mix(o.fx, x, u)), (o.y = mix(o.fy, y, u)));

function step(P, d) {
  const sp = P.sp, ld = P.ld;
  P.t += d;
  for (const s of P.slots) {
    s.t += d;
    const k = s.cake;
    if (s.st === SIDE1) (s.p = s.t / k.S1), (k.b = brown(P) * min(1.3, s.p));
    else if (s.st === SIDE2) s.p = s.t / (k.S1 * 0.62);
    // Steam off the cooking ones, smoke when the iron runs too hot.
    const puff = (f, m) => P.steam.push([s.x + (rnd() - 0.5) * s.R * f, s.y + (rnd() - 0.5) * s.R * f, 1, m]);
    if ((s.st === SIDE2 || (s.st === SIDE1 && s.p > 0.5)) && rnd() < d * 2) puff(1, 0);
    if (s.st >= SIDE1 && rnd() < d * 8 * max(0, P.heat - 0.5)) puff(2, 1);
  }
  // The turner goes to the most overdue pancake first.
  if (!sp.job) {
    let best = null, over = 0;
    for (const s of P.slots) {
      const o = s.st === SIDE1 || (s.st === SIDE2 && !P.pst && P.pat < 0) ? s.p - 1 + (s.rush ? 99 : 0) : -1;
      if (o >= over) (best = s), (over = o);
    }
    if (best) Object.assign(sp, { job: best, ph: 0, t: 0, fx: sp.x, fy: sp.y, mode: best.st === SIDE1 ? FLIP : SERVE });
    else if ((sp.idle += d) > 0.6) (sp.x += (70 - sp.x) * min(1, d * 3)), (sp.y += (140 - sp.y) * min(1, d * 3));
  }
  const s = sp.job;
  if (s) {
    sp.t += d;
    const y0 = s.y + s.R + 6, y1 = s.y + 0.3 * s.R;
    if (sp.ph === 0) {
      glide(sp, s.x, y0, sm(sp.t / GO));
      if (sp.t >= GO) Object.assign(sp, { ph: 1, t: 0 }), Object.assign(s, { st: sp.mode, t: 0, rush: false, land: false });
    } else if (sp.mode === FLIP) {
      // Slide under, lift and turn it over, set it down, pull back.
      const u = (s.u = sp.t / (0.7 * (s.R / 12.7) ** 0.5));
      sp.x = s.x;
      sp.y = u < 0.3 ? mix(y0, y1, sm(u / 0.3)) : u < 0.85 ? y1 - 3 * sin((PI * (u - 0.3)) / 0.55) : mix(y1, y0 + 2, sm((u - 0.85) / 0.15));
      for (let i = 0, a, r, x, y; u >= 0.85 && !s.land && i < 8; i++) {
        [a, r] = [rnd() * 2 * PI, s.R + 1 + rnd() * 4];
        [x, y] = [round(s.x + cos(a) * r), round(s.y + sin(a) * r)];
        P.spat.push([x + 1 - ((x + y) & 1), y, 1]);
      }
      s.land ||= u >= 0.85;
      if (u >= 1) Object.assign(s, { st: SIDE2, t: 0, p: 0 }), (sp.job = null), (sp.idle = 0);
    } else {
      // Slide under, carry it down to the plate, drop it on the stack.
      const u = sp.t / 1.2;
      if (u < 0.25) (sp.x = s.x), (sp.y = mix(y0, y1, sm(u / 0.25)));
      else if (u < 0.85) {
        if (!P.carry) (P.carry = s.cake), Object.assign(s, { cake: null, st: EMPTY, t: 0, melt: 0.8 + rnd() * 0.6 }), ([P.carry.ox, P.carry.oy] = jig());
        const w = sm((u - 0.25) / 0.6), k = P.carry;
        [k.x, k.y, k.lift] = [mix(s.x, PX + k.ox, w), mix(s.y, PY + k.oy, w), sin(PI * w)];
        [sp.x, sp.y] = [k.x, k.y + 0.3 * s.R - 3 * k.lift];
      } else {
        if (P.carry) {
          P.stack.push(P.carry);
          P.carry = null;
          if (P.stack.length >= FULL) P.pat = 0;
          [sp.fx, sp.fy] = [sp.x, sp.y];
        }
        const w = sm((u - 0.85) / 0.15);
        [sp.x, sp.y] = [sp.fx + 8 * w, sp.fy + 14 * w];
      }
      if (u >= 1) (sp.job = null), (sp.idle = 0);
    }
  }
  // The ladle, from the bowl to an empty place, and back to dip again.
  const next = !ld.job && ld.ph === 3 && P.slots.filter((s) => s.st === EMPTY && s.t > s.melt).sort((a, b) => b.t - a.t)[0];
  if (next) Object.assign(ld, { job: next, ph: 0, t: 0, fx: ld.x, fy: ld.y });
  const L = ld.job;
  ld.t += d;
  if (ld.ph === 0 && L) {
    glide(ld, L.x - 2, L.y - 3, sm(ld.t / 0.45));
    if (ld.t >= 0.45) Object.assign(ld, { ph: 1, t: 0 }), Object.assign(L, { st: POUR, t: 0, rs: 0.05, cake: newCake(P, L) });
  } else if (ld.ph === 1 && L) {
    const u = ld.t / (0.9 * (L.R / 12.7));
    L.rs = 1 - (1 - min(1, u)) ** 2;
    if (u >= 1) Object.assign(L, { st: SIDE1, t: 0, p: 0 }), Object.assign(ld, { ph: 2, t: 0, fx: ld.x, fy: ld.y });
  } else if (ld.ph === 2) {
    glide(ld, 11, 110, sm(ld.t / 0.45));
    if (ld.t >= 0.7) (ld.ph = 3), (ld.job = null);
  } else if (!L) Object.assign(ld, { ph: 2, t: 0.45, fx: ld.x, fy: ld.y });
  // A full plate gets butter, goes out to the right, and a clean one comes up.
  if (P.pat >= 0 && (P.pat += d) > 3.5 && !P.pst) P.pst = 1;
  if (P.pst === 1 && (P.pdx += 60 * d) > 60) Object.assign(P, { stack: [], pat: -1, pdx: 0, pdy: 40, pst: 2 });
  if (P.pst === 2 && (P.pdy -= 40 * d) <= 0) (P.pdy = 0), (P.pst = 0);
  P.spat = P.spat.filter((q) => (q[2] -= d * 0.6) > 0);
  P.steam = P.steam.filter((q) => ((q[1] -= (q[3] ? 9 : 6) * d), (q[0] += 2.5 * d), (q[2] -= d * 0.7) > 0));
}

function iron(P) {
  const { sheen, glint, t, heat } = P;
  for (let y = IR0, p = IR0 * W; y <= IR1; y++)
    for (let x = 0, w = (0.85 + 0.15 * sin(y * 0.5 - t * 4)) * 26; x < W; x++, p++) {
      const s = sheen[p] * w;
      B[p * 3] += s;
      B[p * 3 + 1] += s * 0.95;
      B[p * 3 + 2] += s * 0.86;
    }
  for (let i = 0; i < glint.length; i += 3) {
    const p = glint[i], tw = 0.5 + 0.5 * sin(t * glint[i + 2] * (1 + heat) + glint[i + 1]), v = 205 + 50 * (0.4 + 0.6 * sheen[p]) * tw * tw;
    put(p & 63, p >> 6, v, v * 0.94, v * 0.8);
  }
  // Butter melts where the next one goes and fries round the new ones.
  for (const s of P.slots) {
    const m = s.st === EMPTY ? cl(s.t / s.melt, 0, 1) : s.st === POUR ? 1 : s.st === SIDE1 ? 1 - cl(s.t / 3, 0, 1) : 0;
    if (!m) continue;
    const pr = s.R * (s.st === EMPTY ? 0.25 + 0.6 * m : 1 + 0.25 * m), f = floor(t * 7);
    for (let y = floor(s.y - pr); y <= s.y + pr; y++)
      for (let x = floor(s.x - pr); x <= s.x + pr; x++) {
        const d = hypot(x - s.x, y - s.y) / pr;
        if (d > 1) continue;
        blend(x, y, 196, 152, 60, 0.75);
        if ((x + y) & 1 && hash(x * 3 + f, y) < 0.28 * (1 - d * 0.5)) put(x, y, 248, 238, 204);
      }
    if (s.st === EMPTY)
      for (let hs = 2.6 * (1 - 0.8 * m), y = round(s.y - hs); y <= s.y + hs; y++) for (let x = round(s.x - hs); x <= s.x + hs; x++) put(x, y, 252, 232, 140);
  }
  for (const [x, y, l] of P.spat) put(x, y, 120 + 130 * l, 110 + 120 * l, 90 + 90 * l);
}

function plate(P) {
  const cx = PX + round(P.pdx), cy = PY + round(P.pdy), T = P.plate, st = P.stack, bt = BAT[P.bi][0], bw = P.bowl;
  for (let i = 0; i < bw.length; i += 2) {
    const o = bw[i] * 3, k = bw[i + 1], c = k < 0 && P.bi === 1 ? BERRY[0] : bt, f = k < 0 ? (P.bi === 1 ? 1 : 0.95) : k;
    [B[o], B[o + 1], B[o + 2]] = [c[0] * f, c[1] * f, c[2] * f];
  }
  for (let i = 0; i < T.length; i += 5) T[i + 2] < 0 ? dim(cx + T[i], cy + T[i + 1], -T[i + 2]) : put(cx + T[i], cy + T[i + 1], T[i + 2], T[i + 3], T[i + 4]);
  if (!st.length) return;
  shadow(cx + st[0].ox + 1 + 0.4 * st.length, cy + st[0].oy + 1 + 0.4 * st.length, st[0].R, 0.82);
  st.forEach((k, i) => cake(P, k, cx + k.ox, cy + k.oy, 1, 1, 1, 1, 1, 0.9 ** (st.length - 1 - i)));
  if (P.pat < 0) return;
  // The butter pat on top, melting into a glossy pool.
  const top = st[st.length - 1], bx = cx + top.ox + 1, by = cy + top.oy - 1, m = cl(P.pat / 3, 0, 1), pr = 2 + 4.5 * m, hs = 2.4 * (1 - 0.75 * m);
  for (let y = floor(by - pr); y <= by + pr; y++)
    for (let x = floor(bx - pr); x <= bx + pr; x++) {
      const d = hypot(x - bx, y - by) / pr, e = x - bx >= hs - 1 || y - by >= hs - 1;
      if (d < 1) blend(x, y, 252, 222, 124, 0.55 * (1 - d * d));
      if (abs(x - bx) <= hs && abs(y - by) <= hs) put(x, y, e ? 222 : 252, e ? 198 : 238, e ? 112 : 160);
    }
}

// The turner: a slotted steel blade, its edge up the panel, and a wooden
// handle toward the cook's right hand. Its shadow goes down first.
function turner(x, y, blade = 1, grip = 1) {
  const [x0, y0] = [round(x), round(y)];
  for (const pt of [(x, y) => dim(x + 2, y + 3, 0.55), put]) {
    for (let j = -5; blade && j <= 5; j++)
      for (let i = -4; i <= 4; i++) {
        const k = j === -4 ? 1.1 : 0.9 + 0.01 * j, ai = abs(i);
        if (j === -5 && ai === 4) continue;
        if (ai === 4 || abs(j) === 5 || (j === -4 && ai === 3)) pt(x0 + i, y0 + j, 64, 64, 70);
        else if (!(i & 1) && ai < 3 && abs(j) < 3) pt(x0 + i, y0 + j, 40, 38, 38);
        else pt(x0 + i, y0 + j, 200 * k, 202 * k, 208 * k);
      }
    for (let s = 0; grip && s < 24; s++) {
      const x = round(x0 + 0.42 * s), y = y0 + 6 + s, k = s === 9 || s === 17 ? 0 : 0.85 + 0.15 * (s & 1);
      if (s < 4) pt(x, y, 170, 172, 178);
      else for (let w = 0, f = k; w < 2; w++, f *= 0.8) k ? pt(x + w, y, 156 * f, 100 * f, 58 * f) : pt(x + w, y, 214, 184, 112);
    }
  }
}

// The ladle, full of batter until it pours, its handle toward the left hand.
function ladle(P, { x, y, ph }) {
  const [x0, y0, bt, full] = [round(x), round(y), BAT[P.bi][0], ph === 3 || ph === 0];
  for (const pt of [(x, y) => dim(x + 2, y + 3, 0.55), put]) {
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        const d = hypot(i, j), k = 0.8 + 0.2 * cos(atan2(j, i) + 2.3);
        if (d > 3.7) continue;
        if (d > 2.6) pt(x0 + i, y0 + j, 206 * k, 208 * k, 212 * k);
        else if (full) pt(x0 + i, y0 + j, bt[0] * 0.95, bt[1] * 0.95, bt[2] * 0.95);
        else pt(x0 + i, y0 + j, 110, 110, 116);
      }
    for (let s = 4; s < 28; s++) pt(round(x0 - 0.5 * s), round(y0 + 0.86 * s), 184, 186, 192);
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.slots) return;
  B = P.buf;
  B.set(P.bg);
  iron(P);
  plate(P);
  const sp = P.sp, job = sp.job && sp.ph === 1 ? sp.job : null;
  for (const s of P.slots) {
    const k = s.cake;
    if (!k || s === job) continue;
    if (s.st === POUR) cake(P, k, s.x, s.y, 1, 1, 0, 0, s.rs);
    else cake(P, k, s.x, s.y, 1, 1, s.st === SIDE2 ? 1 : 0, s.st === SIDE1 ? s.p : 1);
  }
  if (job) {
    // The blade slides under the pancake, so it goes down before it.
    turner(sp.x, sp.y, 1, 0);
    if (job.cake && sp.mode === FLIP) {
      const u = job.u || 0, v = cl((u - 0.3) / 0.55, 0, 1), l = sin(PI * v), up = u > 0.575;
      if (l > 0) shadow(job.x + 1 + 2 * l, job.y + 2 + 2 * l, job.R, 1 - 0.4 * l);
      cake(P, job.cake, job.x, job.y - 4 * l, 1 + 0.12 * l, cos(PI * v) * (1 + 0.12 * l), up ? 1 : 0, up ? 1 : job.p);
    } else if (job.cake) cake(P, job.cake, job.x, job.y, 1, 1, 1, 1);
    const k = P.carry;
    if (k) {
      shadow(k.x + 1 + 2 * k.lift, k.y + 2 + 3 * k.lift, k.R, 0.6);
      cake(P, k, round(k.x), round(k.y - 2 * k.lift), 1 + 0.1 * k.lift, 1 + 0.1 * k.lift, 1, 1);
    }
    turner(sp.x, sp.y, 0, 1);
  } else turner(sp.x, sp.y);
  // Steam is white and thins as it rises; smoke is grey.
  for (const [x0, y0, l, smoke] of P.steam) {
    const [r, a, c] = smoke ? [4.5, 0.4 * l * cl((P.heat - 0.5) * 2, 0, 1), 128] : [2.6, 0.14 * l, 240];
    for (let y = floor(y0 - r); y <= y0 + r; y++)
      for (let x = floor(x0 - r); x <= x0 + r; x++) {
        const d = hypot(x - x0, y - y0) / r;
        if (d < 1) blend(x, y, c, c - 2, c - 4, a * (1 - d));
      }
  }
  ladle(P, P.ld);
  show(display, B, P.G);
}

// To the panel through a fine grain: neighbouring LEDs lean opposite ways by
// up to 18 levels, as the iron, the batter and the wood never lie quite flat.
function show(display, buf, G) {
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3, r = buf[o], g = buf[o + 1], b = buf[o + 2], L = max(r, g, b, 1);
      const f = 1 + (((x + y) & 1) * 2 - 1) * G[p] * min(17, 0.4 * L) / L;
      display.setPixel(x, y, min(255, max(0, r * f)), min(255, max(0, g * f)), min(255, max(0, b * f)));
    }
}
