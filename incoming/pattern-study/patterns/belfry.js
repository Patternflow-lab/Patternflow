// ===== Patternflow pattern =====
// Title:   Belfry
// Family:  halloween
// Idea:    A black stone bell tower fills the panel against a stormy purple sky and a low orange moon, its bronze bell swinging like a real pendulum while the clapper lags inside and strikes the rim near each end of the swing, each strike sending out a ring of sound and a burst of bats to wheel round the spire, as the green clock creeps to midnight and the bell tolls twelve.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bats=8..40, Storm=0..1
//
// Knob 1: Hue. The moon, the lit windows and the moonlit cloud edges, with the clock and the middle window a quarter of the wheel on; stone, sky and bell stay. At 0 an orange moon and a toxic green clock, at 0.25 a green moon and a sky blue clock, at 0.5 a blue moon and a magenta clock, at 0.75 a magenta moon and an orange clock.
// Knob 2: Speed. At 2 the bell swings there and back in 1.8 s and strikes every 0.93 s, the minute hand goes round in 30 s so the hour tolls every 30 s, and a bat beats its wings 6 to 9 times a second and wheels 7 to 14 s before it flies home; at 0.2 all ten times slower, at 3 half as fast again.
// Knob 3: Bats. How many bats each strike scares out of the belfry and the spire's louvre: 8 at the start, so midnight puts 96 more in the air, 16 at a quarter, 24 at half, 32 at three quarters, 40 at the end. Four times that many stay out between the hours, at most 300 at once.
// Knob 4: Storm. Cloud, wind and lightning. At 0.06 a fifth of the sky is cloud drifting right at 4 LEDs a second and lightning forks down from the top about every 28 s, the first at 5 s; at 0.5 half the sky is cloud moving at 13, it rains, and lightning comes every 15 s; at 1 cloud covers nine tenths of the sky at 23 a second, the rain is heavy and lightning comes every 2 s.
// Buttons: K1 tap sets the hands to two minutes to twelve and the bell tolls midnight at once.

const W = 64, H = 128, N = W * H;
const { floor, round, ceil, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + (b - a) * Math.random();
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

const put = (buf, o, r, g, b) => {
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
};

// The tower, laid out once.
// Its axis is column TX; the moon sits low behind its right shoulder.
const TX = 25, AX = TX + 0.5;
const ARCH_Y = 47.5, ARCH_R = 10.5, SILL = 62;
const PX = AX, PY = 40.5;
const CLX = AX, CLY = 76.5, CLR = 7.5;
const MX = 46, MY = 84, MR = 21;
// Mask codes. BACK is the sky seen through the belfry's back arch.
const SKY = 0, STONE = 1, INSIDE = 2, BACK = 3, FACE = 4, WIN = 5, BEAM = 6;
const MASK = new Uint8Array(N), RIM = new Uint8Array(N), WID = new Int8Array(N).fill(-1);
// Half the tower's width by row, [last row, half]: finial, spire (-2, a
// taper), eave, belfry, ledge, clock stage, ledge, shaft, buttresses.
const ROWS = [[0, -1], [2, 0], [4, 1], [29, -2], [30, 15], [32, 16], [63, 14], [66, 15], [86, 13], [88, 14], [109, 12], [113, 13], [H, 15]];
const half = (y) => {
  const r = ROWS.find((q) => y <= q[0])[1];
  return r === -2 ? round(1 + ((y - 5) * 13) / 24) : r;
};
const groundY = (x) => 121 + round(1.6 * sin(x / 7 + 1) + 0.8 * sin(x / 3.1));
// Gravestones on the ground line: [left column, pixel art].
const GRAVES = [
  [41, [".xxx.", "xxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxx"]],
  [49, ["..x..", "..x..", "xxxxx", "..x..", "..x..", "..x..", "..x..", ".xxx."]],
  [57, [".xx.", "xxxx", "xxxx", "xxxx", "xxxx"]],
];
// A dead tree's limbs, [x0, y0, x1, y1].
const TREE = [[4, 122, 4, 107], [5, 122, 5, 110], [4, 110, 1, 103], [4, 107, 7, 100], [7, 100, 9, 96], [7, 101, 5, 95], [1, 103, 0, 99], [2, 105, -1, 104], [9, 96, 11, 95], [5, 95, 6, 92]];
// Lit windows: [middle column, top row, 0 moon or 1 clock colour, seed].
const WINS = [[TX - 5, 91, 0, 3], [TX + 5, 91, 0, 7], [TX, 101, 1, 11], [TX, 114, 0, 17]];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const p = y * W + x, dx = x + 0.5 - AX, hw = half(y);
    let m = SKY;
    if (hw >= 0 && abs(x - TX) <= hw) m = STONE;
    // Two pinnacles on the corners of the eave.
    for (const c of [TX - 15, TX + 15]) if (y >= 21 && y <= 29 && abs(x - c) <= (y < 25 ? 0 : 1)) m = STONE;
    if (y >= groundY(x)) m = STONE;
    for (const [sx, art] of GRAVES) {
      const r = y - (groundY(sx + 2) - art.length + 1);
      if (r >= 0 && r < art.length && art[r][x - sx] === "x") m = STONE;
    }
    for (const [x0, y0, x1, y1] of TREE) {
      const n = max(abs(x1 - x0), abs(y1 - y0));
      for (let i = 0; i <= n; i++) if (round(x0 + ((x1 - x0) * i) / n) === x && round(y0 + ((y1 - y0) * i) / n) === y) m = STONE;
    }
    // The belfry arch, its back arch and the beam the bell hangs from.
    const ar = sqrt(dx * dx + max(0, ARCH_Y - (y + 0.5)) ** 2);
    if (y < SILL && ar < ARCH_R && y >= 36) {
      m = INSIDE;
      if (sqrt(dx * dx + max(0, ARCH_Y + 1 - (y + 0.5)) ** 2) < 6.8 && y < SILL - 2) m = BACK;
      if (y >= 39 && y <= 40) m = BEAM;
    }
    // A louvre in the spire: three slats with dark gaps.
    if (abs(x - TX) <= 1 && y >= 16 && y <= 21 && y % 2 === 1) m = INSIDE;
    if ((x + 0.5 - CLX) ** 2 + (y + 0.5 - CLY) ** 2 < CLR * CLR) m = FACE;
    // Three lancets and the door, which is wider.
    WINS.forEach(([wx, wy], i) => {
      const r = y - wy, w2 = i === 3 ? 2 : 1;
      if (r >= 0 && r < 5 + w2 && abs(x - wx) <= (r ? w2 : w2 - 1)) (m = WIN), (WID[p] = i);
    });
    MASK[p] = m;
  }
// Rim light where stone meets sky: brightest on the right, towards the
// moon, then on top, then dim on the left.
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (MASK[p] !== STONE) continue;
    const sky = (q) => q >= 0 && q < N && MASK[q] === SKY;
    RIM[p] = x < W - 1 && sky(p + 1) ? 3 : y > 0 && sky(p - W) ? 2 : x > 0 && sky(p - 1) ? 1 : 0;
  }
const RIMC = [0, [50, 20, 76], [92, 40, 132], [124, 56, 176]];

// Sky by row in nine flat steps, deep violet overhead to a dusky mauve low down.
const SKYC = new Float32Array(H * 3);
for (let y = 0; y < H; y++) {
  const t = floor((y / H) * 9) / 8;
  SKYC[3 * y] = 22 + 66 * t;
  SKYC[3 * y + 1] = 6 + 22 * t;
  SKYC[3 * y + 2] = 42 + 50 * t;
}
// The moon's tone at each LED (1 limb, 2 sea, 3 bright) and its glow in
// stepped rings, which also lights the cloud edges there.
const MOONT = new Uint8Array(N), GLOW = new Float32Array(N);
const SEAS = [[-7, -8, 6, 4], [6, -3, 5, 6], [-4, 6, 7, 4], [9, 9, 4, 3]];
for (let p = 0; p < N; p++) {
  const dx = (p % W) + 0.5 - MX, dy = floor(p / W) + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
  if (r < MR) {
    const sea = SEAS.some(([cx, cy, rx, ry]) => ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 < 1);
    MOONT[p] = r > MR - 1.3 ? 1 : sea ? 2 : 3;
    GLOW[p] = 1;
  } else GLOW[p] = r < MR + 3 ? 0.24 : r < MR + 7 ? 0.14 : r < MR + 13 ? 0.07 : r < MR + 22 ? 0.03 : 0;
}
// Clouds: a wrapping noise sheet slid along by the wind. CQ is its values
// sorted, so a cloud cover maps straight to a threshold.
const CW = 128, CH = 32, CN = new Float32Array(CW * CH);
for (let j = 0; j < CH; j++)
  for (let i = 0; i < CW; i++) {
    let v = 0, a = 0.6;
    for (const [cell, sd] of [[16, 1], [8, 2], [4, 3]]) {
      const nx = CW / cell, u = i / cell, w = j / (cell / 2), iu = floor(u), iw = floor(w), fu = u - iu, fw = w - iw;
      const su = fu * fu * (3 - 2 * fu), sw = fw * fw * (3 - 2 * fw);
      const hh = (a2, b2) => hash(((a2 % nx) + nx) % nx * 131 + b2 * 977 + sd * 7);
      v += a * ((hh(iu, iw) * (1 - su) + hh(iu + 1, iw) * su) * (1 - sw) + (hh(iu, iw + 1) * (1 - su) + hh(iu + 1, iw + 1) * su) * sw);
      a *= 0.5;
    }
    CN[j * CW + i] = v;
  }
const CQ = Float32Array.from(CN).sort();

// The bell: a heavy pendulum, 1.8 s there and back at Speed 2, that its
// ringer pushes to a 0.85 rad swing. The clapper is a pendulum 0.4 as long
// hung 0.2 below the bell's pivot and carried by the bell. Shorter, it lags,
// and as the bell slows at the end of a swing its rim comes round onto the
// clapper: a strike when the two are 0.4 rad apart.
const TB = 1.8, AMP = 0.85, CA = 0.2, CLL = 0.4, ALIM = 0.4, BOUNCE = 0.2;
const WB = TAU / TB, G = WB * WB;
// The bell's outline: half its width at distances down its axis from the pivot.
const BV = [1.5, 2.5, 3.5, 5, 9, 11, 13, 14.5], BW = [1.5, 4, 5.3, 5.7, 6.1, 6.8, 7.8, 8.4];
function bellHalf(v) {
  if (v < BV[0] || v > BV[7]) return -1;
  let i = 0;
  while (i < 6 && v > BV[i + 1]) i++;
  return BW[i] + ((BW[i + 1] - BW[i]) * (v - BV[i])) / (BV[i + 1] - BV[i]);
}
const LIP = 14.5, LIPW = 8.4, CLAP = 11.8;
const BRONZE = [[64, 34, 12], [140, 82, 28], [208, 142, 56], [255, 212, 128]];

// Three wing positions, 9 wide close in front, 7 further round, 5 behind.
const SPR = [
  [["x.......x", "xx.....xx", ".xx.x.xx.", "..xxxxx..", "...xxx...", "....x...."], ["x.....x", "xx...xx", ".xx.xx.", "..xxx..", "...x..."], ["x...x", ".x.x.", "..x.."]],
  [["...x.x...", "xxxxxxxxx", ".xx.x.xx.", "....x...."], [".......", "xxx.xxx", ".xxxxx.", "...x..."], ["xx.xx", ".xxx.", "..x.."]],
  [["...x.x...", "..xxxxx..", ".xx.x.xx.", "xx.....xx", "x.......x"], ["...x...", ".xxxxx.", "xx.x.xx", "x.....x"], ["..x..", ".xxx.", "x...x"]],
];

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, nb: 8, storm: 0.06,
    // Clock in minutes past twelve, 0..720: it opens at 11:57.
    clk: 717, toll: 0, count: 0, pump: false, brake: 0,
    th: 0, w: 0, ph: 0, pw: 0, spark: 9, sparkS: 1,
    bats: [], rips: [], rain: [], cloud: 0,
    bolt: null, boltAge: 9, boltWait: 5, begun: false,
    buf: new Float32Array(N * 3), c: [0, 0, 0], g: [0, 0, 0],
  };
}

function spawnBats(S, n) {
  for (let i = 0; i < n && S.bats.length < 300; i++) {
    // Out of the spire's louvre or from under the arch's crown, and away fast.
    const spire = Math.random() < 0.3, side = Math.random() < 0.5 ? -1 : 1;
    const hx = spire ? AX + rnd(-1, 1) : AX + side * rnd(3, 9), hy = spire ? 18.5 : rnd(37.5, 42);
    const a = -PI / 2 + side * rnd(0.2, 1.4), sp = rnd(30, 55);
    S.bats.push({
      x: hx, y: hy, vx: cos(a) * sp + (hx - AX) * 2, vy: sin(a) * sp, mode: 0, t: rnd(0.45, 0.9),
      R: rnd(11, 33), yc: Math.random() < 0.6 ? rnd(4, 40) : rnd(40, 82), w: (Math.random() < 0.5 ? -1 : 1) * rnd(1.1, 2.1), psi: rnd(0, TAU), amp: rnd(3, 11),
      hx, hy, ph: rnd(0, TAU), fr: rnd(6, 9), z: 1, sd: floor(rnd(0, 1e5)),
    });
  }
}

const ring = (S, n) => Object.assign(S, { toll: n, count: 0, pump: true, brake: 0 });

function strike(S, side) {
  S.count++;
  S.spark = 0;
  S.sparkS = side;
  S.rips.push(0);
  spawnBats(S, S.nb);
  if (S.count >= S.toll) {
    S.pump = false;
    S.brake = 2.5;
  }
}

// One small step of the bell and the clapper.
function physics(S, h) {
  const th = S.th, w = S.w, E = 0.5 * w * w + G * (1 - cos(th)), Et = G * (1 - cos(AMP));
  let acc = -G * sin(th);
  if (S.pump) acc += ((3 * (Et - E)) / Et) * w + (E < 0.02 * Et ? 2 * (w >= 0 ? 1 : -1) : 0);
  else if (S.brake > 0) acc -= 3 * w;
  else acc += -0.4 * w + S.storm * 1.6 * vn(S.t * 0.8, 5);
  // The clapper's pivot rides on the bell; its acceleration swings the clapper.
  const ax = CA * (acc * cos(th) - w * w * sin(th)), ay = CA * (-acc * sin(th) - w * w * cos(th));
  let pacc = (-G * sin(S.ph) - ax * cos(S.ph) + ay * sin(S.ph)) / CLL;
  if (!S.pump) pacc -= 0.4 * (S.pw - w);
  S.th += (S.w += acc * h) * h;
  S.ph += (S.pw += pacc * h) * h;
  // After the last stroke the ringer checks the bell and holds the clapper,
  // or it would knock once more.
  if (S.brake > 0) {
    S.ph += (S.th - S.ph) * min(1, h * 8);
    S.pw = S.w;
  }
  const rel = S.ph - S.th;
  if (abs(rel) > ALIM) {
    const s = rel > 0 ? 1 : -1, rv = S.pw - S.w;
    S.ph = S.th + s * ALIM;
    if (rv * s > 0) {
      if (abs(rv) > 0.5 && S.pump) strike(S, s);
      S.pw = S.w - BOUNCE * rv;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06], d = cl(dt || 0, 0, 0.1);
  [S.hue, S.speed, S.nb, S.storm] = [cl(k[0], 0, 1), cl(k[1], 0.2, 3), round(cl(k[2], 8, 40)), cl(k[3], 0, 1)];
  if (!S.begun) {
    S.boltWait = 5 - 3 * S.storm;
    S.begun = true;
    // Four strikes' worth of bats are already out, along their rings.
    spawnBats(S, 4 * S.nb);
    for (const b of S.bats)
      Object.assign(b, { mode: 1, t: rnd(1, 12), x: AX + b.R * cos(b.psi), y: b.yc + b.amp * sin(b.psi) * 0.6, vx: -b.R * b.w * sin(b.psi), vy: 0, z: sin(b.psi) });
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  // The clock gains 2 minutes a second at Speed 2. Two minutes before each
  // hour the ringer starts the bell, so the first strike falls on the hour,
  // and it strikes the hour: twelve at midnight.
  const was = S.clk;
  S.clk += ds * 2;
  if (input.btnPressed && input.btnPressed[0]) {
    S.clk = 718;
    ring(S, 12);
  } else if (floor((was + 2) / 60) !== floor((S.clk + 2) / 60) && !S.pump) ring(S, floor((S.clk + 2) / 60) % 12 || 12);
  if (S.clk >= 720) S.clk -= 720;
  for (let i = 0; i < 8; i++) physics(S, ds / 8);
  S.brake -= ds;
  S.spark += ds;
  // Sound rings run out at 38 LEDs a second for 1.4 s.
  S.rips = S.rips.map((a) => a + ds).filter((a) => a < 1.4);
  // Wind: the clouds slide 4 to 23 LEDs a second and the bats lean with it.
  const wind = 3 + 20 * S.storm;
  S.cloud += ds * wind;
  const lean = 5 * S.storm;
  // As many stay out between the hours: as bats go home, others slip out.
  if (S.bats.length < 4 * S.nb && Math.random() < ds * 4) spawnBats(S, 1);
  S.bats = S.bats.filter((b) => {
    b.ph += ds * TAU * b.fr * (b.mode === 0 ? 1.4 : 1);
    if (b.mode === 0) {
      const f = exp(-2.2 * ds);
      b.x += (b.vx *= f) * ds;
      b.y += (b.vy *= f) * ds;
      if ((b.t -= ds) < 0) {
        b.mode = 1;
        b.t = rnd(7, 14);
        b.psi = Math.acos(cl((b.x - AX) / b.R, -1, 1)) * (b.y < b.yc ? -1 : 1);
      }
      return true;
    }
    let tx, ty;
    if (b.mode === 1) {
      // Round the spire on a tilted ring, in front of it while sin(psi) > 0.
      b.psi += b.w * ds;
      tx = AX + b.R * cos(b.psi) + lean;
      ty = b.yc + b.amp * sin(b.psi) * 0.6 + 2.5 * vn(S.t * 0.9, b.sd);
      b.z = sin(b.psi);
      if ((b.t -= ds) < 0) b.mode = 2;
    } else {
      tx = b.hx;
      ty = b.hy;
      b.z += (1 - b.z) * min(1, ds * 3);
      if (abs(b.x - tx) < 1.2 && abs(b.y - ty) < 1.2) return false;
    }
    const kk = b.mode === 2 ? 9 : 6, cc = b.mode === 2 ? 5 : 4.2;
    b.x += (b.vx += (kk * (tx - b.x) - cc * b.vx) * ds) * ds;
    b.y += (b.vy += (kk * (ty - b.y) - cc * b.vy) * ds) * ds;
    return true;
  });
  // Lightning: a fork from the top edge.
  S.boltAge += ds;
  if ((S.boltWait -= ds) < 0) {
    S.boltAge = 0;
    S.boltWait = (30 - 28 * S.storm) * rnd(0.6, 1.4);
    let x = Math.random() < 0.5 ? rnd(2, 12) : rnd(40, 62), y = 0;
    const pts = [x, y], end = rnd(26, 58);
    while (y < end) {
      x += rnd(-3, 3);
      y += rnd(2, 5);
      pts.push(x, y);
    }
    S.bolt = pts;
  }
  // Rain from Storm 0.3 up.
  const want = round(max(0, S.storm - 0.3) * 140);
  while (S.rain.length < want) S.rain.push([rnd(-10, W + 10), rnd(-H, H)]);
  S.rain.length = want;
  for (const r of S.rain) {
    r[0] += ds * wind * 1.5;
    if ((r[1] += ds * 150) > H) (r[1] -= H + rnd(0, 20)), (r[0] = rnd(-20, W));
  }
}

// Flash brightness at a bolt's age: a stroke, a dim gap and a restrike.
const flashOf = (a) => (a < 0.07 ? 1 : a < 0.13 ? 0.25 : a < 0.21 ? 0.8 : a < 0.5 ? 0.8 * (1 - (a - 0.21) / 0.29) : 0);

function add(buf, x, y, c, f) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  for (let i = 0, o = (y * W + x) * 3; i < 3; i++) buf[o + i] += c[i] * f;
}

function drawBats(S, buf, front) {
  for (const b of S.bats) {
    if (b.z < -0.15 === front) continue;
    const s = sin(b.ph), fr = s > 0.35 ? 0 : s < -0.35 ? 2 : 1, spr = SPR[fr][b.z > 0.55 ? 0 : front ? 1 : 2];
    const ox = round(b.x) - (spr[0].length >> 1), oy = round(b.y) - 1;
    for (let j = 0; j < spr.length; j++)
      for (let i = 0; i < spr[j].length; i++) {
        if (spr[j][i] !== "x") continue;
        const x = ox + i, y = oy + j;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = (y * W + x) * 3;
        // Black against the sky; over black stone, moonlit wings instead.
        const dark = max(buf[o], buf[o + 1], buf[o + 2]) < 34;
        put(buf, o, dark ? 60 : 8, dark ? 28 : 3, dark ? 82 : 14);
      }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, M = hsv(0.075 + S.hue, 0.8, 1, S.c), Gc = hsv(0.32 + S.hue, 0.78, 1, S.g);
  const F = S.bolt ? flashOf(S.boltAge) : 0;
  const cover = 0.17 + 0.73 * S.storm, thr = CQ[floor((1 - cover) * (CQ.length - 1))];
  const off = S.cloud;
  for (let y = 0; y < H; y++) {
    const fy = y / 2.6, j0 = floor(fy) % CH, j1 = (j0 + 1) % CH, ty = fy - floor(fy);
    // Clouds keep off the bottom rows, over the roofs.
    const band = y > 100 ? (y - 100) * 0.03 : 0;
    const fl = F * max(0, 1 - y / 80);
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = 3 * p;
      let R = SKYC[3 * y] + fl * 70, Gg = SKYC[3 * y + 1] + fl * 60, B = SKYC[3 * y + 2] + fl * 100;
      const gl = GLOW[p], mt = MOONT[p];
      if (mt) {
        // The seas are paler, not darker: dark orange would read as brown.
        const v = mt === 1 ? 0.86 : 1, wv = mt === 2 ? 0.3 : 0;
        (R = (M[0] + (255 - M[0]) * wv) * v), (Gg = (M[1] + (255 - M[1]) * wv) * v), (B = (M[2] + (255 - M[2]) * wv * 0.7) * v);
      } else if (gl > 0) {
        R += M[0] * gl, Gg += M[1] * gl, B += M[2] * gl;
      }
      // A cloud here: thin edges catch the moonlight, cores are dark.
      const fx = (x + off) * 0.32, i0 = floor(fx), tx = fx - i0, a0 = ((i0 % CW) + CW) % CW, a1 = (a0 + 1) % CW;
      const n = (CN[j0 * CW + a0] * (1 - tx) + CN[j0 * CW + a1] * tx) * (1 - ty) + (CN[j1 * CW + a0] * (1 - tx) + CN[j1 * CW + a1] * tx) * ty;
      const e = n - band - thr;
      if (e > 0) {
        const lit = min(1, gl * 2.2) + fl;
        if (e < 0.025) {
          (R = 64 + M[0] * 0.55 * lit), (Gg = 32 + M[1] * 0.55 * lit), (B = 84 + M[2] * 0.4 * lit);
        } else if (e < 0.07) {
          (R = 44 + M[0] * 0.18 * lit), (Gg = 22 + M[1] * 0.18 * lit), (B = 60 + M[2] * 0.12 * lit);
        } else {
          (R = 30 + fl * 30), (Gg = 14 + fl * 24), (B = 44 + fl * 40);
        }
      }
      put(buf, o, R, Gg, B);
    }
  }
  // The bolt, behind the tower.
  if (F > 0.5 && S.bolt) {
    const P = S.bolt;
    for (let i = 0; i + 3 < P.length; i += 2) {
      const n = ceil(max(abs(P[i + 2] - P[i]), abs(P[i + 3] - P[i + 1])) * 2);
      for (let j = 0; j <= n; j++) {
        const x = round(P[i] + ((P[i + 2] - P[i]) * j) / n), y = round(P[i + 1] + ((P[i + 3] - P[i + 1]) * j) / n);
        if (x >= 0 && x < W && y >= 0 && y < H) put(buf, (y * W + x) * 3, 235, 225, 255);
      }
    }
  }
  drawBats(S, buf, false);
  // The tower.
  const sk = S.spark < 0.12, cs = cos(S.th), sn = sin(S.th), rel = S.ph - S.th;
  const bx = CLAP * sin(rel), by = 3 + CLAP * cos(rel);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = 3 * p, m = MASK[p];
      if (m === SKY) continue;
      if (m === STONE) {
        let R = 7, Gg = 3, B = 12;
        const r = RIM[p];
        if (r) {
          const c = RIMC[r], f = 1 + F * 0.8;
          (R = c[0] * f), (Gg = c[1] * f), (B = c[2] * f);
        }
        // Green light spilling from the clock onto the stone round it.
        const cd = sqrt((x + 0.5 - CLX) ** 2 + (y + 0.5 - CLY) ** 2);
        if (cd < 12.5) {
          const f = cd < 8.6 ? 0.1 : cd < 10.5 ? 0.16 : 0.07;
          R += Gc[0] * f, Gg += Gc[1] * f, B += Gc[2] * f;
        }
        put(buf, o, R, Gg, B);
        continue;
      }
      if (m === WIN) {
        const [, , kind, sd] = WINS[WID[p]], c = kind ? Gc : M;
        // Candlelight: two noises, about 2 and 7 times a second, in three steps.
        const v = 0.62 + 0.24 * vn(S.t * 2.2, sd) + 0.14 * vn(S.t * 7, sd + 1), lv = WID[p] === 3 ? 0.72 : 1;
        const f = (v > 0.78 ? 1 : v > 0.56 ? 0.8 : 0.6) * lv;
        put(buf, o, c[0] * f, c[1] * f, c[2] * f);
        continue;
      }
      if (m === FACE) {
        const dx = x + 0.5 - CLX, dy = y + 0.5 - CLY, r = sqrt(dx * dx + dy * dy), f = r < 3.5 ? 1 : r < 6 ? 0.86 : 0.72;
        put(buf, o, Gc[0] * f, Gc[1] * f, Gc[2] * f);
        continue;
      }
      if (m === BEAM) {
        if (y === 39) put(buf, o, 86, 46, 22);
        else put(buf, o, 44, 22, 10);
        continue;
      }
      // Inside the belfry: dark, with the sky through the back arch.
      if (m === BACK) for (let c = 0; c < 3; c++) buf[o + c] *= 0.62;
      else put(buf, o, 14, 7, 22);
      if (y < 41) continue;
      // The bell, in its own frame: u across, v down its axis from the pivot.
      const dx = x + 0.5 - PX, dy = y + 0.5 - PY, u = dx * cs - dy * sn, v = dx * sn + dy * cs;
      const hw = bellHalf(v), lipv = abs(u) < LIPW ? LIP + 1.8 * sqrt(1 - (u / LIPW) ** 2) : -1;
      const mouth = (u / 6.8) ** 2 + ((v - LIP) / 1.3) ** 2 < 1;
      // The clapper's ball, seen inside the mouth.
      const ball = (u - bx) ** 2 + (v - by) ** 2 < 2.6;
      if (mouth) {
        const lt = u - bx + (v - by) < -0.5;
        if (ball) put(buf, o, lt ? 150 : 70, lt ? 140 : 62, lt ? 150 : 74);
        else put(buf, o, 22, 10, 6);
        continue;
      }
      if ((hw >= 0 && abs(u) <= hw) || (v > LIP && v <= lipv)) {
        // Bronze in four tones: a bright band left of the middle, a moonlit
        // rim on the right, dark edges and a rib round the waist.
        const t = u / (hw > 0 ? hw : LIPW);
        let tone = t < -0.78 ? 0 : t < -0.18 ? 2 : t < 0.5 ? 1 : t < 0.82 ? 0 : 2;
        if (v > LIP - 0.6) tone = t < -0.3 ? 3 : 2;
        else if (abs(v - 4.2) < 0.5 || abs(v - 12.6) < 0.45) tone = max(0, tone - 1);
        if (t > -0.6 && t < -0.3 && v > 5 && v < 11) tone = 3;
        const c = BRONZE[tone];
        put(buf, o, c[0], c[1], c[2]);
      } else if (ball && v > LIP) {
        put(buf, o, 70, 62, 74);
      }
    }
  // The spark where the clapper hits the soundbow.
  if (sk) {
    const u = S.sparkS * 6.2, v = LIP - 0.4, x = PX + u * cs + v * sn, y = PY - u * sn + v * cs;
    for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) add(buf, x - 0.5 + i, y - 0.5 + j, [255, 240, 190], 1);
  }
  // The clock: twelve ticks and two hands, the hour hand short.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, x = round(CLX + 6.2 * sin(a) - 0.5), y = round(CLY - 6.2 * cos(a) - 0.5), o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) buf[o + c] *= 0.25;
  }
  const hand = (a, len) => {
    for (let r = 0; r <= len; r += 0.35) put(buf, (round(CLY - r * cos(a) - 0.5) * W + round(CLX + r * sin(a) - 0.5)) * 3, 6, 14, 6);
  };
  hand(((S.clk % 60) / 60) * TAU, 6.6);
  hand((S.clk / 720) * TAU, 4.2);
  drawBats(S, buf, true);
  // Rings of sound from the bell, two at a time, fading in steps.
  for (const a of S.rips) {
    const r = 3 + 38 * a, f = a < 0.45 ? 0.3 : a < 0.9 ? 0.2 : 0.11;
    for (const [rr, ff] of [[r, f], [r - 5, f * 0.55]]) {
      if (rr < 2) continue;
      const n = ceil(TAU * rr * 1.2);
      for (let i = 0; i < n; i++) add(buf, PX - 0.5 + rr * cos((i / n) * TAU), 52 - 0.5 + rr * sin((i / n) * TAU), [210, 170, 255], ff);
    }
  }
  for (const [rx, ry] of S.rain) {
    const sl = 0.3 + 0.05 * (3 + 20 * S.storm);
    for (let j = 0; j < 3; j++) add(buf, rx + sl * j, ry + j, [110, 96, 160], 0.55);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
}
