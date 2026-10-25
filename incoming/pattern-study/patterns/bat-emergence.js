// ===== Patternflow pattern =====
// Title:   Bat Emergence
// Family:  halloween
// Idea:    At dusk a ribbon of bats pours out of a cave mouth in a dark ridge and climbs the whole panel in pulses, twisting and swaying like smoke where the gusts push it, each bat a three-LED silhouette flapping against a sky that runs from deep purple to burnt orange.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bats=400..1200, Swirl=0..1
//
// Knob 1: Hue. Turns the sky round the wheel; the bats stay black. At 0 it is deep purple overhead, mauve and dusky rose lower down, and burnt orange going to peach over the ridge; at 0.5 green overhead, teal lower down and sky blue over the ridge.
// Knob 2: Speed. At 2 a bat takes 4.7 seconds from the cave mouth to the top of the panel and beats its wings 5 times a second, and about 5,200 bats leave the cave a minute; at 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Bats. How many are in the air on average: 400 at the start, a ribbon over the ridge with sky showing through it; at 1200 the lower ribbon is solid black. The stream comes in pulses about every 3.7 seconds, and between pulses the cave lets out 0.15 of what it lets out at their height.
// Knob 4: Swirl. How hard the column twists and sways. At 0 the ribbon turns once in the panel's height, the waves running up it swing its top up to 7 LEDs and a gust leans it up to 5 more; at 0.06, where the knob opens, about the same; at 1 it turns four times, swings 23 LEDs and a gust leans it 18.

const W = 64, H = 128;
const { floor, min, max, sin, cos, exp, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The sky, top to horizon, as hue, saturation and value stops at heights
// 0..1 of the sky. Hue runs the short way round between stops.
const SKY = [
  [0, 0.75, 0.86, 0.26],
  [0.4, 0.79, 0.74, 0.42],
  [0.7, 0.9, 0.56, 0.6],
  [0.86, 0.02, 0.52, 0.8],
  [0.94, 0.065, 0.62, 0.93],
  [1, 0.09, 0.5, 1],
];
// The ridge: its height above the bottom row at each column, and the cave
// mouth, an arch MW wide at the base and MH tall, centred on column MX.
const MX = 29.5, MW = 7, MH = 8;
const RIDGE = new Float32Array(W);
for (let x = 0; x < W; x++)
  RIDGE[x] = 13 + 4 * sin(x * 0.09 + 0.6) + 2.4 * sin(x * 0.23 + 2.1) + 1.2 * sin(x * 0.61 + 0.3) + 4 * exp(-(((x - MX) / 9) ** 2));
const RIDGE_TOP = H - 1 - 13;
// The row of the top of the cave mouth; a bat's height is counted from it.
const MOUTH_Y = H - 1 - MH + 1;
const MAXB = 2600;
// Rise speed in rows per second of scene time, and flaps per second.
const VUP = 20, FLAP = 5;

export function setup(params) {
  const S = (params.s = {
    hue: -1, speed: 2, bats: 400, swirl: 0.06, t: 0, begun: false,
    x: new Float32Array(MAXB), y: new Float32Array(MAXB), sl: new Float32Array(MAXB), th: new Float32Array(MAXB), dp: new Float32Array(MAXB), jt: new Float32Array(MAXB),
    ph: new Float32Array(MAXB), fr: new Float32Array(MAXB), vv: new Float32Array(MAXB), live: new Uint8Array(MAXB),
    count: 0, next: 0, carry: 0, gust: 0, gustV: 0, gustTo: 0, gustWait: 2,
    sky: new Float32Array(H * 3), rgb: new Float32Array(W * H * 3), stars: [],
  });
  for (let i = 0; i < 9; i++) S.stars.push([floor(hash(i * 7 + 1) * W), floor(hash(i * 7 + 2) * 36), hash(i * 7 + 3) * TAU]);
}

// The column's centre at height h above the mouth: waves running up it like
// smoke, wider higher up, and the gust bending the top.
function centre(S, h, sw) {
  const t = S.t, u = h / 120;
  return (
    MX +
    sw * (4 * u * sin(h * 0.045 - 1.1 * t) + 2.5 * u * u * sin(h * 0.09 - 1.7 * t + 1.3) + 1.2 * sin(h * 0.02 - 0.5 * t + 2)) +
    S.gust * 18 * u * u
  );
}

// Pulses: the stream thickens about every 3.7 seconds.
const pulse = (t) => {
  const p = 0.5 + 0.5 * sin(TAU * (t / 3.7) + 0.8 * sin((TAU * t) / 9.1));
  return 0.15 + 0.85 * p * p;
};

function spawn(S) {
  // The next free slot, searched from where the last one was found.
  let i = -1;
  for (let n = 0; n < MAXB; n++) {
    const j = (S.next + n) % MAXB;
    if (!S.live[j]) {
      i = j;
      break;
    }
  }
  if (i < 0) return;
  S.next = (i + 1) % MAXB;
  S.count = max(S.count, i + 1);
  S.live[i] = 1;
  S.x[i] = MX + (Math.random() * 2 - 1) * (MW / 2 - 0.5);
  S.y[i] = H - 1 - Math.random() * (MH - 2);
  S.sl[i] = Math.random() * 2 - 1;
  S.th[i] = Math.random() * 2 - 1;
  S.jt[i] = Math.random() * TAU;
  S.ph[i] = Math.random();
  S.fr[i] = FLAP * (0.8 + 0.4 * Math.random());
  S.vv[i] = 0.75 + 0.5 * Math.random();
}

function step(S, dt) {
  S.t += dt;
  const sw = 0.9 + 2.1 * S.swirl, twist = (TAU * (1 + 3 * S.swirl)) / 120;
  // Gusts: every 3 to 8 seconds the wind picks a new lean, eased in.
  S.gustWait -= dt;
  if (S.gustWait <= 0) {
    S.gustTo = (Math.random() * 2 - 1) * (0.3 + 0.7 * S.swirl);
    S.gustWait = 3 + 5 * Math.random();
  }
  S.gustV += ((S.gustTo - S.gust) * 1.6 - S.gustV * 1.8) * dt;
  S.gust += S.gustV * dt;
  // Bats leaving the cave per second: 0.43 times S.bats at the height of a
  // pulse, which keeps about S.bats in the air on average.
  S.carry += S.bats * 0.43 * pulse(S.t) * dt;
  while (S.carry >= 1) {
    spawn(S);
    S.carry -= 1;
  }
  const { x, y, sl, th, dp, jt, ph, fr, vv, live } = S, k = min(1, 8 * dt);
  for (let i = 0; i < S.count; i++) {
    if (!live[i]) continue;
    const h = MOUTH_Y - y[i], u = cl(h / 120, 0, 1.2);
    // Out of the mouth fast, slower over the ridge, then faster again as
    // the column breaks up at the top.
    y[i] -= vv[i] * VUP * (1 + 0.6 * exp(-h / 12)) * (0.8 + 1.8 * u * u) * dt;
    // The ribbon: a flat band turning about the column, each bat at its
    // own place across it, so where the band turns edge-on it pinches and
    // the bats on it cross over. It widens as it climbs and frays at the top.
    const wdt = 3 + 20 * u ** 1.3 + 90 * max(0, u - 0.55) ** 2, phi = twist * h - 1.3 * S.t + 0.4, c = cos(phi), sn = sin(phi);
    const tx = centre(S, h, sw) + wdt * (sl[i] * c + 0.18 * th[i] * sn) + sin(jt[i] + 2.3 * S.t) * (0.4 + 1.5 * u);
    dp[i] = sl[i] * sn;
    x[i] += (tx - x[i]) * k;
    ph[i] += fr[i] * dt;
    if (y[i] < -3 || x[i] < -4 || x[i] > W + 3) live[i] = 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 400, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hueK = kn[0];
  S.speed = cl(kn[1], 0.2, 3);
  S.bats = cl(kn[2], 400, 1200);
  S.swirl = cl(kn[3], 0, 1);
  // The first frame opens on a column already standing up the panel.
  if (!S.begun) {
    S.begun = true;
    for (let k = 0; k < 140; k++) step(S, 1 / 20);
  }
  step(S, (d * S.speed) / 2);
}

function paintSky(S) {
  const c = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const f = cl(y / RIDGE_TOP, 0, 1);
    let j = 0;
    while (j < SKY.length - 2 && f > SKY[j + 1][0]) j++;
    const a = SKY[j], b = SKY[j + 1], t = (f - a[0]) / (b[0] - a[0]);
    let dh = b[1] - a[1];
    dh -= round(dh);
    hsv(S.hueK + a[1] + dh * t, mix(a[2], b[2], t), mix(a[3], b[3], t), c, 0);
    S.sky[y * 3] = c[0];
    S.sky[y * 3 + 1] = c[1];
    S.sky[y * 3 + 2] = c[2];
  }
  S.hue = S.hueK;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.hue !== S.hueK) paintSky(S);
  const { rgb, sky } = S;
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) {
      rgb[q] = sky[y * 3];
      rgb[q + 1] = sky[y * 3 + 1];
      rgb[q + 2] = sky[y * 3 + 2];
    }
  // A few faint stars high up, breathing slowly.
  for (const [sx, sy, sp] of S.stars) {
    const q = (sy * W + sx) * 3, a = 0.18 + 0.12 * sin(0.9 * S.t + sp);
    rgb[q] += a;
    rgb[q + 1] += a;
    rgb[q + 2] += a;
  }
  // The ridge: dark purple, its skyline lit by the afterglow, and the cave
  // mouth black.
  const r0 = sky[RIDGE_TOP * 3], g0 = sky[RIDGE_TOP * 3 + 1], b0 = sky[RIDGE_TOP * 3 + 2];
  for (let x = 0; x < W; x++) {
    const top = H - RIDGE[x];
    for (let y = max(0, floor(top)); y < H; y++) {
      const q = (y * W + x) * 3, rim = y - top < 1.2 ? 0.5 : 0;
      const dx = (x + 0.5 - MX) / (MW / 2), dy = (H - 0.5 - y) / MH;
      const cave = dx * dx + dy * dy < 1;
      if (cave) rgb[q] = rgb[q + 1] = rgb[q + 2] = 0;
      else {
        rgb[q] = 0.15 + rim * r0 * 0.5;
        rgb[q + 1] = 0.075 + rim * g0 * 0.5;
        rgb[q + 2] = 0.17 + rim * b0 * 0.5;
      }
    }
  }
  // The bats: three LEDs each, wings up, level, down, a third of a beat
  // each. Bats on the far side of the band are a little hazed with the sky
  // behind them, which shows which way the ribbon turns.
  const { x, y, ph, dp, live } = S;
  for (let i = 0; i < S.count; i++) {
    if (!live[i]) continue;
    const bx = round(x[i]), by = round(y[i]), st = floor(ph[i] * 3) % 3, wy = st - 1, hz = 0.3 * max(0, -dp[i]);
    for (let w = -1; w <= 1; w++) {
      const px = bx + w, py = by + (w ? wy : 0);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const q = (py * W + px) * 3, sy = min(py, RIDGE_TOP) * 3;
      rgb[q] = 0.02 + hz * sky[sy];
      rgb[q + 1] = 0.008 + hz * sky[sy + 1];
      rgb[q + 2] = 0.03 + hz * sky[sy + 2];
    }
  }
  for (let yy = 0, q = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, q += 3) display.setPixel(xx, yy, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
