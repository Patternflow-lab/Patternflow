// ===== Patternflow pattern =====
// Title:   Specimen Shelf
// Family:  halloween
// Idea:    Three specimen jars on two shelves, toxic green and amber above and violet below, each hold a floating eyeball; one turns to stare out at you, the others glance at it and turn one after another, then all of them look away together, roll up in a blink and drift apart, while bubbles rise and a knock on a shelf sets the fluid sloshing and glowing.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bubbles=0..1, Knock=0..1
//
// Knob 1: Hue. Turns the three fluids round the wheel together, each iris with its fluid: at 0 toxic green with a magenta iris and amber with a blue iris on the top shelf, violet with a gold iris below. At 0.33 they are blue, green and amber, at 0.67 red, violet and teal. The whites, veins, nerves, lids, cork and shelves stay as they are.
// Knob 2: Speed. At 2 one round of the story takes 12 s: the first eye turns to stare 0.6 s in, the second glances at it at 1.3 s and stares at 1.8, the third glances at 2.1 and stares at 2.6; they stare until 4.4, look away together until 5.3, blink and drift from 5.7. Each round a different eye starts. A small bubble rises through its jar in about 3 s. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Bubbles. At 0 four bubbles a second across the three jars, a third of them rings; at 0.5 about 18 a second; at 1 sixty a second, four in five of them rings up to 5 LEDs across in the small jars and 7 in the big one.
// Knob 4: Knock. How often something knocks a shelf, and how hard. At 0 the first knock comes 6.6 s in and then one every 12 s; at 0.06, 6.3 s in and every 11.4 s; at 1, 1.5 s in and every 1.8 s, twice as hard. Each knock hits the other shelf from the last: the board jolts 2 LEDs sideways, dust falls from under it or jumps off it, the fluid tilts 3 rows at the glass (6 at 1) and sloshes for about 2 s, glowing brighter while it settles, a burst of bubbles shakes loose, and every eye that is not staring turns toward the knock.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, sqrt, atan2, acos, exp, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const q = (v, n) => round(v * n) / n;
const wrap = (a) => a - TAU * floor((a + PI) / TAU);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), qq = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? qq : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? qq : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? qq : p];
}

// The two shelves: the top of each board and the row its front ends.
const SHELF = [[56, 61], [119, 127]];
// The three jars. Rows: lid (or cork), neck, shoulder, body, rounded bottom,
// thick base. Half-widths inside the glass. surf is the fluid's resting
// row, ex/ey/er the eye's rest and radius, hue the fluid's colour, iris the
// eye's, lum how bright the fluid is away from the light.
const JARS = [
  { cx: 16, lid: [5, 10], lidW: 11.5, cork: 0, neck: [11, 13], neckW: 9, sh: [14, 18], w: 12, bot: [50, 54], base: 55, shelf: 0,
    surf: 19, ex: 16, ey: 36, er: 7, hue: 0.29, iris: 0.83, irisS: 0.8, lum: 0.08 },
  { cx: 48, lid: [4, 9], lidW: 5.5, cork: 1, neck: [10, 17], neckW: 5, sh: [18, 28], w: 12.5, bot: [49, 54], base: 55, shelf: 0,
    surf: 24, ex: 48, ey: 40, er: 7, hue: 0.09, iris: 0.6, irisS: 0.8, lum: 0.2 },
  { cx: 32, lid: [63, 69], lidW: 22.5, cork: 0, neck: [70, 72], neckW: 18, sh: [73, 79], w: 23, bot: [111, 117], base: 118, shelf: 1,
    surf: 81, ex: 32, ey: 98, er: 11, hue: 0.78, iris: 0.12, irisS: 0.72, lum: 0.07, gold: 1 },
];
function halfIn(J, y) {
  if (y < J.neck[0] || y >= J.bot[1]) return -1;
  if (y < J.sh[0]) return J.neckW;
  if (y < J.sh[1]) {
    const u = (J.sh[1] - y) / (J.sh[1] - J.sh[0]);
    return J.neckW + (J.w - J.neckW) * sqrt(1 - u * u);
  }
  if (y < J.bot[0]) return J.w;
  const u = (y - J.bot[0]) / (J.bot[1] - J.bot[0]);
  return J.w - (J.w * 0.25) * (1 - sqrt(1 - u * u));
}

// Veins on the white, laid out in the eye's own angles (th from the gaze
// axis, ph round it) so they turn with it; tabled once, ph against th.
const VEINS = [], VT = 65;
for (let k = 0; k < 7; k++) {
  const ph0 = (k * TAU) / 7 + 0.35 * sin(k * 2.3), a = 0.22 + 0.08 * sin(k * 1.7), f = 3 + (k % 3), p = k * 1.3;
  const tab = new Float32Array(VT);
  for (let j = 0; j < VT; j++) {
    const th = (j * PI) / (VT - 1);
    tab[j] = ph0 + a * sin(f * th + p) + 0.1 * sin(9 * th + 2 * p);
  }
  VEINS.push({ tab, end: 0.8 + 0.1 * ((k * 5) % 3) });
}
const IRIS = 0.62;
// The fluid's glow round an eye, falling off by e every 5 LEDs, tabled.
const EXP5 = Float32Array.from({ length: 64 }, (_, i) => exp(-i / 20));

export function setup(params) {
  // Per LED: which jar (0 none, else 1 + index) and what part of it.
  // 1 fluid side of the glass, 2 glass wall, 3 thick base, 4 lid, 5 cork,
  // 6 shelf top, 7 shelf front, 0 the wall behind.
  const reg = new Uint8Array(N), jar = new Uint8Array(N), glow = new Float32Array(N);
  JARS.forEach((J, j) => {
    J.hw = new Float32Array(H);
    for (let y = 0; y < H; y++) J.hw[y] = halfIn(J, y);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x, dx = abs(x + 0.5 - J.cx), hw = J.hw[y];
        let r = 0;
        if (y >= J.lid[0] && y <= J.lid[1]) {
          const lw = J.cork ? J.lidW - 0.15 * (y - J.lid[0]) : y === J.lid[0] ? J.lidW - 1.5 : y === J.lid[0] + 1 ? J.lidW - 0.5 : J.lidW;
          if (dx < lw) r = J.cork ? 5 : 4;
        } else if (hw > 0 && dx < hw) r = 1;
        else if (hw > 0 && dx < hw + 1.3) r = 2;
        else if (y >= J.bot[1] && y <= J.base && dx < J.w * 0.8 + 1) r = 3;
        if (r) (reg[i] = r), (jar[i] = j + 1);
        // How much of this jar's glow reaches the wall here.
        const top = J.lid[0], bot = J.base;
        const ddx = max(0, dx - (hw > 0 ? hw + 1 : J.w)), ddy = y < top ? top - y : y > bot ? y - bot : 0;
        const gw = exp(-hypot(ddx, ddy) / 5);
        if (!r && !reg[i] && gw > glow[i]) (glow[i] = gw), (jar[i] = j + 1);
      }
  });
  SHELF.forEach(([a, b]) => {
    for (let y = a; y <= b; y++) for (let x = 0; x < W; x++) reg[y * W + x] = y < a + 2 ? 6 : 7;
  });
  params.s = {
    t: 0, hue: 0, speed: 2, bub: 0, knockK: 0.06,
    reg, jar, glow,
    eyes: JARS.map((J, j) => ({
      yaw: 0.6 - 0.6 * j, pitch: 0.2, roll: 0, tyaw: 0.6, tpitch: 0.2, next: 0.5 + 0.7 * j, rate: 2,
      stare: 0, dil: 0, ox: 0, oy: 0, vx: 0, vy: 0, ph: j * 2.1,
    })),
    slosh: JARS.map(() => ({ a: 0, v: 0, ag: 0 })),
    bubbles: [], acc: 0, pops: [], dust: [], kSide: 1, cyc: -1, look: [0, 0],
    knockAt: 0, kAge: 9, kShelf: 0,
    rgb: new Float32Array(N * 3), nerve: new Float32Array(N),
  };
}

// The story, in seconds at Speed 2, one round of 12 s: one eye turns to
// stare out at 0.6; the next glances at it at 1.3 and stares at 1.8; the
// last glances at 2.1 and stares at 2.6; at 4.4 all three look away to the
// same place, at 5.3 they roll up and back down together, a blink, and from
// 5.7 each drifts on its own.
const ROUND = 12;
function story(S, e, j, tc, order) {
  const pos = order.indexOf(j), st = [0.6, 1.8, 2.6][pos], gl = [9, 1.3, 2.1][pos];
  if (tc >= 5.3 && tc < 5.7) return { yaw: 0, pitch: -1.75, rate: 16, stare: 0 };
  if (tc >= 4.4 && tc < 5.3) return { yaw: S.look[0], pitch: S.look[1], rate: 11, stare: 0 };
  if (tc >= st && tc < 4.4) return { yaw: 0, pitch: 0, rate: 6, stare: 1 };
  if (tc >= gl && tc < st) {
    // Glance at whichever has already turned.
    const L = JARS[order[0]], J = JARS[j];
    const dx = L.ex - J.ex, dy = L.ey - J.ey;
    return { yaw: atan2(dx, 10), pitch: cl(atan2(dy, hypot(dx, 10)), -1, 1), rate: 9, stare: 0 };
  }
  return null;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.bub = cl(k[2], 0, 1);
  S.knockK = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.t += g;
  const cyc = floor(S.t / ROUND), tc = S.t - cyc * ROUND;
  if (cyc !== S.cyc) {
    S.cyc = cyc;
    // Who starts this round, and where all three look together.
    const o = [[2, 0, 1], [1, 2, 0], [0, 1, 2]][cyc % 3];
    S.order = o;
    const looks = [[-1.1, -0.5], [1.1, 0.3], [0.2, 0.9], [-0.9, 0.6]];
    S.look = looks[cyc % 4];
  }
  // Knocks: the first 6.6 s in at 0, 1.5 s in at 1; then every 12 s at 0
  // and every 1.8 s at 1. Each hits the other shelf from the last.
  S.knockAt += g;
  const first = mix(6.6, 1.5, S.knockK), every = mix(12, 1.8, S.knockK);
  if (S.knockAt >= (S.knocks ? every : first)) {
    S.knockAt = 0;
    S.knocks = (S.knocks || 0) + 1;
    S.kAge = 0;
    S.kShelf = S.knocks % 2;
    const hard = 0.6 + 0.6 * S.knockK, side = S.knocks % 3 === 1 ? -1 : 1;
    S.kSide = side;
    JARS.forEach((J, j) => {
      const near = J.shelf === S.kShelf ? 1 : 0.35;
      S.slosh[j].v += side * hard * near * 20;
      S.slosh[j].ag = min(1.5, S.slosh[j].ag + hard * near);
      const e = S.eyes[j];
      e.vx += side * hard * near * 22;
      e.vy -= hard * near * 16;
    });
    // Dust shaken off the board: down from under the top shelf, up off the
    // bottom one.
    for (let n = 0; n < 14 + 10 * S.knockK; n++) {
      const top = S.kShelf === 0;
      S.dust.push({ x: Math.random() * W, y: top ? SHELF[0][1] + 1 : SHELF[1][0] - 1, vx: (Math.random() - 0.5) * 6, vy: top ? 2 + 6 * Math.random() : -8 - 10 * Math.random(), life: 1.2 + Math.random() });
    }
    // A rush of bubbles shaken loose.
    for (let n = 0; n < 10 + 14 * S.knockK; n++) spawn(S, floor(Math.random() * 3), true);
  }
  S.kAge += g;
  for (const m of S.dust) {
    m.vy += 14 * g;
    m.x += m.vx * g;
    m.y += m.vy * g;
    m.life -= g;
  }
  S.dust = S.dust.filter((m) => m.life > 0 && m.y < H);
  JARS.forEach((J, j) => {
    // The fluid's tilt, a damped swing of about 1.4 a second.
    const sl = S.slosh[j];
    sl.v += (-80 * sl.a - 2.2 * sl.v) * g;
    sl.a += sl.v * g;
    // Shaken, the fluid lights up, and settles back in about a second.
    sl.ag *= exp(-g * 1.1);
    const e = S.eyes[j];
    let tg = story(S, e, j, tc, S.order);
    if (!tg && S.kAge < 1) {
      // A knock: every idle eye looks round at it.
      const up = JARS[j].shelf > S.kShelf ? -0.6 : JARS[j].shelf < S.kShelf ? 0.6 : 0.15;
      tg = { yaw: S.kSide * 1, pitch: up, rate: 10, stare: 0 };
      e.next = min(e.next, 1.2);
    }
    if (!tg) {
      // Drifting: somewhere new to look every 1.5 to 3.5 s.
      e.next -= g;
      if (e.next <= 0) {
        e.next = 1.5 + 2 * Math.random();
        e.tyaw = (Math.random() * 2 - 1) * (Math.random() < 0.15 ? 1.9 : 0.9);
        e.tpitch = (Math.random() * 2 - 1) * 0.6;
      }
      tg = { yaw: e.tyaw, pitch: e.tpitch, rate: 2, stare: 0 };
    } else (e.tyaw = tg.yaw), (e.tpitch = tg.pitch);
    const r = min(1, g * tg.rate);
    e.yaw += wrap(tg.yaw - e.yaw) * r;
    e.pitch += (tg.pitch - e.pitch) * r;
    e.roll = 0.3 * sin(S.t * 0.23 + j) + 0.12 * sin(S.t * 0.61 + 2 * j);
    e.stare += (tg.stare - e.stare) * min(1, g * (tg.stare ? 4 : 2.5));
    e.dil += ((tg.stare && e.stare > 0.6 ? 1 : 0) - e.dil) * min(1, g * 2.4);
    // A knock throws the eye; a spring brings it back.
    e.vx += (-30 * e.ox - 3 * e.vx) * g;
    e.vy += (-30 * e.oy - 3 * e.vy) * g;
    e.ox += e.vx * g;
    e.oy += e.vy * g;
  });
  // Bubbles: a few a second from each jar at 0, a fizz at 1.
  S.acc += g * mix(4, 60, S.bub * S.bub);
  while (S.acc >= 1) {
    S.acc -= 1;
    spawn(S, floor(Math.random() * 3), false);
  }
  for (const b of S.bubbles) {
    const J = JARS[b.j];
    b.v = min(b.v + g * 30, 7 + 6 * b.r);
    b.y -= b.v * g;
    b.x += 2.5 * sin(b.ph + b.y * 0.3) * g;
    b.x = cl(b.x, J.cx - J.hw[cl(round(b.y), 0, H - 1)] + 1, J.cx + J.hw[cl(round(b.y), 0, H - 1)] - 1);
    if (b.y < surfAt(S, b.j, b.x) + 0.5) {
      b.dead = 1;
      S.pops.push({ x: b.x, j: b.j, life: 0.25 });
    }
  }
  S.bubbles = S.bubbles.filter((b) => !b.dead);
  for (const p of S.pops) p.life -= g;
  S.pops = S.pops.filter((p) => p.life > 0);
}
function spawn(S, j, shaken) {
  const J = JARS[j];
  const x = J.cx + (Math.random() * 2 - 1) * J.w * 0.7;
  const y = shaken ? J.surf + 6 + Math.random() * (J.bot[0] - J.surf - 6) : J.bot[0] + 1;
  const r = Math.random() < 0.3 + 0.5 * S.bub ? 1.1 + Math.random() * (0.5 + 1.2 * S.bub) * (J.er / 7) : 0.5;
  S.bubbles.push({ j, x, y, z: Math.random() * 2 - 1, r, v: shaken ? 4 : 1, ph: TAU * Math.random() });
}
// The fluid's surface row at x, tilted by the slosh and rippled.
function surfAt(S, j, x) {
  const J = JARS[j], t = S.t, a = S.slosh[j].a;
  return J.surf + (a * (x - J.cx)) / J.w * 2.2 + 0.5 * sin(0.4 * x + 1.9 * t + j) + 0.35 * sin(0.7 * x - 2.6 * t) * (1 + 2 * abs(a));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, reg, jar, glow, nerve } = S, t = S.t;
  const fls = JARS.map((J) => hsv(J.hue + S.hue, 0.92, 1));
  const irs = JARS.map((J) => hsv(J.iris + S.hue, J.irisS, 1));
  // Each eye this frame: where it sits and which way it faces.
  const E = JARS.map((J, j) => {
    const e = S.eyes[j], bob = 1 - 0.6 * e.stare, s2 = J.er / 11;
    const ex = J.ex + (3 * sin(t * 0.45 + 1 + j * 2) * bob) * s2 + e.ox;
    const ey = J.ey + (5 * sin(t * 0.9 + j * 1.7) + 1.2 * sin(t * 2.1 + j)) * bob * s2 + e.oy;
    const er = J.er * (1 + 0.15 * e.stare);
    const ca = cos(e.yaw), sa = sin(e.yaw), cb = cos(e.pitch), sb = sin(e.pitch);
    const f = [sa * cb, sb, ca * cb];
    const r0 = [ca, 0, -sa], u0 = [-sa * sb, cb, -ca * sb];
    const cr = cos(e.roll), sr = sin(e.roll);
    const rx = [r0[0] * cr + u0[0] * sr, r0[1] * cr + u0[1] * sr, r0[2] * cr + u0[2] * sr];
    const ux = [u0[0] * cr - r0[0] * sr, u0[1] * cr - r0[1] * sr, u0[2] * cr - r0[2] * sr];
    return { ex, ey, er, f, rx, ux, pupil: mix(0.36, 0.72, e.dil), front: f[2] < 0, stare: e.stare };
  });
  // The optic nerves: a pink cord from the back of each eye, hanging and
  // waving in the fluid.
  nerve.fill(0);
  E.forEach((v, j) => {
    let bx = -v.f[0], by = -v.f[1];
    const bl = hypot(bx, by);
    let dx = bl > 0.05 ? bx / bl : 0, dy = bl > 0.05 ? by / bl : 1;
    let x = v.ex + v.er * bx, y = v.ey + v.er * by;
    const sc = v.er / 11;
    for (let s = 0; s < 11; s++) {
      const rad = (2.2 - 0.1 * s) * max(0.7, sc);
      for (let yy = floor(y - rad); yy <= y + rad; yy++)
        for (let xx = floor(x - rad); xx <= x + rad; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H || jar[yy * W + xx] !== j + 1) continue;
          const dd = sqrt((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2);
          if (dd < rad) nerve[yy * W + xx] = max(nerve[yy * W + xx], dd < rad - 1 ? 1 : 0.6);
        }
      const a = atan2(dy, dx), wave = 0.32 * sin(t * 1.6 - s * 0.45 + j);
      const na = a + 0.12 * wrap(PI / 2 - a) + wave * 0.35;
      dx = cos(na);
      dy = sin(na);
      x += 2 * sc * dx;
      y += 2 * sc * dy;
    }
  });

  // The light rippling through the fluid: three wavy bands, lit where their
  // sum crosses zero. Each band's inner wave is worked out once a frame.
  const cs = S.cs || (S.cs = new Float32Array(2 * W + 2 * H));
  for (let y = 0; y < H; y++) cs[y] = 0.9 * sin(y * 0.15 + t * 0.9);
  for (let x = 0; x < W; x++) cs[H + x] = 0.9 * sin(x * 0.19 - t * 0.6);
  for (let i = 0; i < W + H; i++) cs[H + W + i] = 0.7 * sin((i - H) * 0.12 + t * 0.9);
  const sc = S.sc || (S.sc = new Float32Array(3 * W));
  for (let j = 0; j < 3; j++) for (let x = 0; x < W; x++) sc[j * W + x] = surfAt(S, j, x + 0.5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, rg = reg[i], jj = jar[i] - 1, px = x + 0.5, py = y + 0.5;
      let r = 0.035, gg = 0.012, b = 0.06;
      const J = JARS[jj], fl = fls[jj];
      if (rg === 1) {
        const sy = sc[jj * W + x] - (abs(px - J.cx) > J.hw[y] - 1.5 ? 1 : 0);
        if (py < sy - 0.5) {
          r = 0.03 + 0.06 * fl[0];
          gg = 0.02 + 0.08 * fl[1];
          b = 0.06 + 0.06 * fl[2];
        } else {
          const v = E[jj], cyl = 1 - ((px - J.cx) / J.hw[y]) ** 2;
          const a1 = x * 0.27 + cs[y] + t * 0.75 + jj;
          const a2 = y * 0.2 + cs[H + x] - t * 1.1;
          const a3 = (x + y) * 0.15 + cs[H + W + x - y + H];
          const cv = abs(sin(a1) + sin(a2) + sin(a3));
          const caus = cv < 0.3 ? 1 - cv / 0.3 : 0;
          const de = sqrt((px - v.ex) ** 2 + (py - v.ey) ** 2) - v.er;
          const flare = 1 + 0.6 * v.stare + 1.4 * S.slosh[jj].ag;
          let L = (J.lum + 0.2 * cyl * cyl) * flare + caus * (0.3 + 0.4 * cyl) + (de > 0 && de < 16 ? 0.1 * (0.6 + 1.6 * v.stare) * EXP5[floor(de * 4)] : 0);
          if (py < sy + 0.5) L = 0.95;
          L = q(L, 14);
          r = fl[0] * L;
          gg = fl[1] * L;
          b = fl[2] * L;
        }
      } else if (rg === 2) {
        r = 0.14 + 0.22 * fl[0];
        gg = 0.16 + 0.24 * fl[1];
        b = 0.2 + 0.22 * fl[2];
      } else if (rg === 3) {
        r = fl[0] * 0.45;
        gg = fl[1] * 0.45;
        b = fl[2] * 0.45;
      } else if (rg === 4) {
        // Pewter lid, ridged, with a bright band.
        const dx = abs(px - J.cx), rnd = 0.6 + 0.4 * sqrt(max(0, 1 - (dx / J.lidW) ** 2));
        const ridge = (y - J.lid[0]) % 2 === 0 ? 1.25 : 0.8;
        const spec = abs(px - (J.cx - J.lidW * 0.5)) < 1.2 ? 2.6 : 1;
        const vv = ridge * spec * rnd * (y === J.lid[1] ? 0.6 : 1);
        r = 0.17 * vv;
        gg = 0.13 * vv;
        b = 0.25 * vv;
        if (y === J.lid[0]) (r = 0.42), (gg = 0.36), (b = 0.52);
      } else if (rg === 5) {
        // The cork, grainy and lit from the left.
        const dx = px - J.cx, grain = ((x * 7 + y * 13) % 5) / 5;
        const vv = (0.75 - 0.05 * dx) * (0.85 + 0.25 * grain) * (y === J.lid[0] ? 1.2 : 1);
        r = 0.62 * vv;
        gg = 0.36 * vv;
        b = 0.24 * vv;
      } else if (rg === 6) {
        // The shelf top: the jars' glow pools under them.
        let pr = 0, pg = 0, pb = 0;
        JARS.forEach((K, k) => {
          if (SHELF[K.shelf][0] !== y && SHELF[K.shelf][0] + 1 !== y) return;
          const pool = exp(-abs(px - K.cx) / (K.w * 0.7)), f2 = fls[k];
          pr += 0.45 * pool * f2[0];
          pg += 0.45 * pool * f2[1];
          pb += 0.45 * pool * f2[2];
        });
        r = 0.2 + pr;
        gg = 0.1 + pg;
        b = 0.28 + pb;
      } else if (rg === 7) {
        const edge = y === SHELF[0][0] + 2 || y === SHELF[1][0] + 2;
        r = edge ? 0.26 : 0.1;
        gg = edge ? 0.15 : 0.04;
        b = edge ? 0.36 : 0.16;
      } else if (jj >= 0) {
        const gw = 0.1 * glow[i] * (1 + 0.8 * E[jj].stare);
        r += gw * fl[0];
        gg += gw * fl[1];
        b += gw * fl[2];
      }
      if (rg === 1) {
        const v = E[jj], u = (px - v.ex) / v.er, w = (py - v.ey) / v.er, d2 = u * u + w * w, nv = nerve[i];
        if (nv && (v.front || d2 >= 1)) {
          r = 0.9 * nv;
          gg = 0.32 * nv;
          b = 0.42 * nv;
        } else if (d2 < 1) {
          const f = v.f, rx = v.rx, ux = v.ux, iris = irs[jj];
          const nz = sqrt(1 - d2), cosA = u * f[0] + w * f[1] + nz * f[2];
          const th = acos(cl(cosA, -1, 1)), sh = 0.55 + 0.45 * nz;
          if (th < IRIS * v.pupil) (r = 0), (gg = 0), (b = 0);
          else if (th < IRIS) {
            const tt = th / IRIS;
            const ph = atan2(u * ux[0] + w * ux[1] + nz * ux[2], u * rx[0] + w * rx[1] + nz * rx[2]);
            // Never below 0.6 of full, and the gold one near full, so that
            // it stays gold and does not turn olive.
            const streak = 0.8 + 0.2 * sin(ph * 13 + 3 * sin(ph * 4));
            let vv = tt > 0.86 ? 0.05 : streak * (tt < v.pupil + 0.12 ? 1 : 0.88) * (0.85 + 0.15 * sh);
            if (J.gold && vv > 0.1) vv = 0.9 + 0.1 * streak;
            r = iris[0] * vv;
            gg = iris[1] * vv;
            b = iris[2] * vv;
          } else {
            const rim = (1 - nz) * (1 - nz);
            r = mix(1, fl[0], 0.7 * rim) * sh;
            gg = mix(0.97, fl[1], 0.7 * rim) * sh;
            b = mix(0.95, fl[2], 0.7 * rim) * sh;
            const ph = atan2(u * ux[0] + w * ux[1] + nz * ux[2], u * rx[0] + w * rx[1] + nz * rx[2]);
            const st = sin(th) * v.er, jt = round((th / PI) * (VT - 1)), wd = 0.4 + 0.3 * (th / PI);
            for (const vn of VEINS)
              if (th >= vn.end && abs(wrap(ph - vn.tab[jt])) * st < wd) {
                r = 0.8 * sh;
                gg = 0.02 * sh;
                b = 0.06 * sh;
                break;
              }
          }
          if ((u + 0.38) ** 2 + (w + 0.42) ** 2 < 0.03) (r = 1), (gg = 1), (b = 1);
        }
      }
      // The glass catches the light down its left side.
      if ((rg === 1 || rg === 2) && abs(px - (J.cx - J.hw[y] - 0.2)) < 0.8 && y > J.sh[1] && y < J.bot[0]) {
        r += 0.22;
        gg += 0.22;
        b += 0.22;
      }
      const o = i * 3;
      rgb[o] = r;
      rgb[o + 1] = gg;
      rgb[o + 2] = b;
    }
  // Bubbles: a bright point, or a ring for the bigger ones; those behind the
  // eye are hidden by it.
  for (const bb of S.bubbles) {
    const R = bb.r, v = E[bb.j], fl = fls[bb.j], x0 = floor(bb.x - R - 1), y0 = floor(bb.y - R - 1);
    for (let y = y0; y <= y0 + 2 * R + 2; y++)
      for (let x = x0; x <= x0 + 2 * R + 2; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H || reg[y * W + x] !== 1 || jar[y * W + x] !== bb.j + 1) continue;
        if (bb.z < 0 && (x + 0.5 - v.ex) ** 2 + (y + 0.5 - v.ey) ** 2 < v.er * v.er) continue;
        const dd = sqrt((x + 0.5 - bb.x) ** 2 + (y + 0.5 - bb.y) ** 2);
        if (R < 1 ? dd < 0.75 : abs(dd - R) < 0.55) {
          const o = (y * W + x) * 3;
          rgb[o] = mix(fl[0], 1, 0.6);
          rgb[o + 1] = mix(fl[1], 1, 0.6);
          rgb[o + 2] = mix(fl[2], 1, 0.6);
        }
      }
  }
  // A popped bubble flicks two drops off the surface.
  for (const p of S.pops) {
    const fl = fls[p.j];
    for (const dx of [-1, 1]) {
      const x = floor(p.x + dx * (1.5 - p.life * 2)), y = floor(surfAt(S, p.j, p.x) - 2 - (p.life < 0.12 ? 1 : 0));
      if (x < 0 || x >= W || y < 0 || y >= H || reg[y * W + x] !== 1) continue;
      const o = (y * W + x) * 3;
      rgb[o] = mix(fl[0], 1, 0.5);
      rgb[o + 1] = mix(fl[1], 1, 0.5);
      rgb[o + 2] = mix(fl[2], 1, 0.5);
    }
  }
  for (const m of S.dust) {
    const x = floor(m.x), y = floor(m.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3, a = 0.5 * min(1, m.life);
    rgb[o] = max(rgb[o], 0.75 * a);
    rgb[o + 1] = max(rgb[o + 1], 0.62 * a);
    rgb[o + 2] = max(rgb[o + 2], 0.8 * a);
  }
  // A knock jolts its shelf sideways for a moment.
  const jolt = S.kAge < 0.5 ? round(2.2 * sin(S.kAge * 40) * exp(-S.kAge / 0.18)) : 0;
  const j0 = S.kShelf ? 62 : 0, j1 = S.kShelf ? H : 62;
  for (let i = 0; i < N; i++) {
    const x = i % W, y = floor(i / W);
    const sx = jolt && y >= j0 && y < j1 ? cl(x - jolt, 0, W - 1) : x, o = (y * W + sx) * 3;
    display.setPixel(x, y, 4 * round(63.75 * cl(rgb[o], 0, 1)), 4 * round(63.75 * cl(rgb[o + 1], 0, 1)), 4 * round(63.75 * cl(rgb[o + 2], 0, 1)));
  }
}
