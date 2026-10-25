// ===== Patternflow pattern =====
// Title:   Music Box
// Family:  halloween
// Idea:    A haunted music box on a velvet shelf: its brass cylinder turns and each pin plucks a steel tooth that flashes and rings, a skeleton ballerina in a tutu pirouettes on the spindle under a cone of moonlight, then the spring runs down, the melody drags to a stop with her facing us, a cloud covers the moon and her eye sockets glow green, until an unseen hand spins the key and it plays again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Velvet=0..1, Speed=0.2..3, Tune=0..1, Wind=0..1
//
// Knob 1: Velvet. The colour of the velvet on the box, the lining behind the cylinder and the shelf, through the cold hues only so it never turns brown: purple at 0, blue at 0.33, teal at 0.67, poison green at 1. The brass, the steel, the bones and the moonlight stay as they are.
// Knob 2: Speed. At 2 the waltz plays a beat every 0.42 seconds and the ballerina turns once a bar; at Wind 0.06 a wind plays 4.8 seconds at full tempo and then runs down over 1.2 to 4.2, as long as it takes her to stop facing us; the eyes glow for 2.2 and the key spins for 1.5. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Tune. Which of three A minor melodies is on the box, each on its own cylinder with its own dance: below 1/3 a waltz with an oom-pah-pah bass on brass, the ballerina in lilac with her arms rounded overhead; from 1/3 a slow lullaby on nickel silver, a pale blue tutu and the arms open wide; from 2/3 a brisk minuet on blackened steel, a black tutu edged in orange and the arms low in front. She turns once a bar of each tune's tempo.
// Knob 4: Wind. How far the key is wound, so how long the box plays at full tempo before it runs down: 0.8 seconds at 0, 4.8 at 0.06, 9 at 0.25, 17.2 at 1.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, sqrt, atan2, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The box, front on: its top from row 60 to the brass front edge at 66,
// the velvet front to 115, the shelf below. A glass window shows the
// cylinder (rows 71 to 87) and the comb whose 13 teeth hang from row 88.
const TOP = 60, RIM = 66, BOT = 115, BX0 = 2, BX1 = 57;
const WX0 = 6, WX1 = 53, WY0 = 69, WY1 = 106;
const CX0 = 9, CX1 = 50, CY = 79, CR = 8;
const TEETH = 13, TX = 11, TIP = 88, PLATE = 103;
const toothLen = (i) => round(15 - 0.55 * i);
// The spindle and the ballerina's toe, the key on the box's right side.
const SPX = 30, TOE = 58, KX = 60, KY = 92;
// The run-down's share of a wind, the glow and the winding, in seconds.
const SLOW = 1.8, GLOW = 2.2, WIND = 1.5;
// The cloud's puffs: offset across, offset down, radius.
const PUFFS = [[-13, 4, 4.5], [-7, 2, 6.5], [0, 0, 8], [7.5, 2, 6.5], [13, 5, 4.5]], CLOUD = [0.13, 0.1, 0.2], CLOUD_RIM = [0.36, 0.33, 0.5];
// A cylinder for each tune, five shades and its pins: brass with steel pins,
// nickel silver with brass ones, blackened steel with silver ones.
const METALS = [
  [[[0.76, 0.48, 0.08], [0.88, 0.6, 0.12], [0.96, 0.72, 0.2], [1, 0.84, 0.36], [1, 0.93, 0.62]], [1, 0.97, 0.86]],
  [[[0.42, 0.45, 0.52], [0.58, 0.62, 0.7], [0.72, 0.76, 0.84], [0.86, 0.9, 0.96], [0.97, 0.98, 1]], [1, 0.78, 0.25]],
  [[[0.1, 0.1, 0.14], [0.17, 0.17, 0.23], [0.25, 0.26, 0.33], [0.36, 0.37, 0.46], [0.55, 0.56, 0.66]], [0.95, 0.96, 1]],
];
// And a tutu for each: lilac tulle, pale ghostly blue, black edged in orange.
const TUTUS = [
  [[0.55, 0.4, 0.7], [0.78, 0.62, 0.9], [0.95, 0.85, 1]],
  [[0.5, 0.62, 0.75], [0.72, 0.84, 0.95], [0.93, 0.98, 1]],
  [[0.1, 0.06, 0.12], [0.24, 0.16, 0.28], [1, 0.55, 0.1]],
];

// The comb, low to high: A3 B3 C4 D4 E4 F4 G#4 A4 B4 C5 D5 E5 F5, A minor
// with the raised seventh. Each tune is 8 bars of 3 beats, one turn of the
// cylinder, written as [beat, tooth] pins, and its beat in story seconds.
const TUNES = [
  // Waltz: bass on the bar, a chord tone on beats 2 and 3, the tune on top.
  {
    beat: 0.42,
    bass: [[0, 4, 4], [1, 3, 3], [1, 3, 3], [0, 4, 4], [3, 5, 5], [0, 4, 4], [1, 3, 3], [0, 4, 4]],
    tune: [[0, 11], [2, 9], [3, 8], [4, 9], [5, 8], [6, 6], [8, 4], [9, 7], [12, 12], [14, 10], [15, 9], [16, 10], [17, 9], [18, 8], [19, 6], [20, 8], [21, 7]],
  },
  // Lullaby: slow, the bass and one tone a bar, the tune in long notes.
  {
    beat: 0.55,
    bass: [[0, 2, -1], [1, 3, -1], [0, 4, -1], [3, 5, -1], [3, 5, -1], [0, 2, -1], [1, 3, -1], [0, 4, -1]],
    tune: [[0, 7], [2, 9], [3, 8], [5, 6], [6, 7], [8, 4], [9, 5], [12, 10], [14, 12], [15, 11], [17, 9], [18, 8], [20, 6], [21, 7]],
  },
  // Minuet: brisk, a note on every beat.
  {
    beat: 0.32,
    bass: [[0, -1, -1], [3, -1, -1], [0, -1, -1], [1, -1, -1], [3, -1, -1], [0, -1, -1], [1, -1, -1], [0, -1, -1]],
    tune: [7, 9, 11, 10, 9, 8, 9, 7, 4, 6, 8, 11, 12, 11, 10, 9, 8, 7, 8, 6, 4, 7, -1, 11].map((t, b) => [b, t]).filter((q) => q[1] >= 0),
  },
];
// Every pin of a tune, sorted by beat.
const PINS = TUNES.map((T) => {
  const p = T.tune.slice();
  T.bass.forEach(([b, c1, c2], bar) => {
    p.push([bar * 3, b]);
    if (c1 >= 0) p.push([bar * 3 + 1, c1]);
    if (c2 >= 0) p.push([bar * 3 + 2, c2]);
  });
  return p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
});

// The ballerina in her own frame, y up from the toe, z toward us when she
// faces us: standing leg en pointe, the other drawn up in retire with its
// knee turned out, arms rounded overhead. One unit is SC LEDs.
const J = {
  toe: [0, 0, 0], ank: [-0.1, 2.5, 0], kn: [-0.5, 9.5, 0], hipS: [-1.2, 16.6, 0],
  hipW: [1.2, 16.6, 0], knW: [6.8, 12.6, 1.4], ftW: [-0.1, 10.2, 1.1],
  waist: [0, 18.2, 0], chest: [0, 26, 0], neck: [0, 29.4, 0], head: [0, 33, 0.2],
  shL: [-3.6, 27, 0], shR: [3.6, 27, 0], elL: [-6.4, 31.8, 0.9], elR: [6.4, 31.8, 0.9], haL: [-1.4, 38.2, 1.1], haR: [1.4, 38.2, 1.1],
};
// The other two dances: the lullaby's attitude, the leg lifted behind and
// the arms open to the sides; the minuet's arms rounded low in front.
const POSES = [
  {},
  { knW: [2.4, 16.4, -7.2], ftW: [3.6, 20.6, -11.4], elL: [-8.2, 28.4, 0.6], elR: [8.2, 28.4, 0.6], haL: [-12.6, 29.8, 0], haR: [12.6, 29.8, 0] },
  { elL: [-5.6, 23.6, 2.6], elR: [5.6, 23.6, 2.6], haL: [-1.6, 21.6, 4.6], haR: [1.6, 21.6, 4.6] },
];
const SC = 1.3, ELEV = 0.28, CE = cos(ELEV), SE = sin(ELEV), HEAD_R = 3.5, TUTU_Y = 17.6, TUTU_R = 9.5;
const RIBS = [[20.8, 2.3], [22.4, 2.9], [24, 3.1], [25.6, 2.9]];

// The cloud's shape, 40 by 12 about its middle: 1 inside a puff, 2 on a
// lower rim not covered by another puff.
function cloudMask() {
  const m = new Uint8Array(40 * 12);
  for (let y = 0; y < 12; y++)
    for (let j = 0; j < 40; j++) {
      let inside = false, deep = false;
      for (const [dx, dy, r] of PUFFS) {
        const d = Math.hypot(j + 0.5 - 20 - dx, y + 0.5 - dy);
        if (d < r) (inside = true), (deep = deep || d < r - 1.2);
      }
      if (inside) m[y * 40 + j] = !deep && y > 3 ? 2 : 1;
    }
  return m;
}

// The tutu's LEDs: for each, where it meets each of the three layers of the
// disc, as a radius and an angle in the room; turning her only adds phi.
function tutuMap() {
  const out = [], yc = floor(TOE + 0.5 - SC * TUTU_Y * CE), RM = TUTU_R + 0.7;
  for (let y = yc - 6; y <= yc + 6; y++)
    for (let x = SPX - 14; x <= SPX + 15; x++) {
      const xr = (x + 0.5 - SPX - 0.5) / SC, layers = [];
      for (const h of [TUTU_Y - 0.7, TUTU_Y, TUTU_Y + 0.7]) {
        const zr = ((y + 0.5 - TOE - 0.5) / SC + h * CE) / SE, r = Math.hypot(xr, zr);
        if (r < RM) layers.push(r, atan2(zr, xr));
      }
      if (layers.length) out.push([x, y, layers]);
    }
  return out;
}

export function setup(params) {
  const motes = [];
  for (let i = 0; i < 18; i++) motes.push([Math.random(), Math.random() * 58, 1.5 + 2.5 * Math.random(), Math.random() * TAU]);
  params.s = {
    rgb: new Float32Array(N * 3), cloudMask: cloudMask(), tutu: tutuMap(), motes, started: false,
    hue: 0.5, speed: 1.5, tuneI: 0, wind: 0.06, t: 0.5,
    phase: "play", ph: 0.5, tau: 4.5, beat: 0.5, phi: 0.5, phiA: 0.5, D: 1.5,
    key: 0.5, amp: 0.5, cloud: 0.5, ring: new Float32Array(TEETH), wave: new Float32Array(TEETH), spark: new Float32Array(TEETH), eyes: 0.5,
  };
}

// Seconds of play a wind gives, the run-down included.
const runFor = (w) => 2.6 + 16.4 * sqrt(w);
// Full tempo while playing; in the run-down it falls as (left / D)^0.8.
const tempo = (S) => (S.phase === "play" ? 1 : S.phase === "slow" ? (max(0, S.D - S.ph) / S.D) ** 0.8 : 0);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.tuneI = min(2, floor(cl(k[2], 0, 1) * 3));
  S.wind = cl(k[3], 0, 1);
  const T = TUNES[S.tuneI], pins = PINS[S.tuneI], g = (d * S.speed) / 2;
  if (!S.started) {
    // The first pin plucks a quarter second in, the ballerina already turning.
    S.started = true;
    S.tau = runFor(S.wind) - SLOW;
    S.beat = 24 - 0.25 / T.beat;
    S.phi = 0;
    S.ph = 0;
    S.t = 0;
  }
  S.t += g;
  S.ph += g;
  const f = tempo(S), om = TAU / (3 * T.beat);
  if (S.phase === "play" || S.phase === "slow") {
    // The cylinder: beats go by at the tempo, and every pin passed plucks.
    const b0 = S.beat, b1 = b0 + (g * f) / T.beat;
    for (const [b, tooth] of pins) {
      const at = b < b0 ? b + 24 : b;
      if (at > b0 && at <= b1) (S.ring[tooth] = 1), (S.spark[tooth] = 1);
    }
    S.beat = b1 >= 24 ? b1 - 24 : b1;
    S.key += 0.6 * f * g;
  }
  if (S.phase === "play") {
    S.phi += om * g;
    S.tau -= g;
    if (S.tau <= 0) {
      // The run-down: she turns om D / 1.8 more as the tempo falls to 0 over
      // D seconds, so D is chosen to end that on a whole turn, facing us,
      // and at least 1.2 seconds long.
      const k = Math.ceil((S.phi + (1.2 * om) / 1.8) / TAU);
      (S.phase = "slow"), (S.ph = 0), (S.phiA = S.phi), (S.D = (1.8 * (TAU * k - S.phi)) / om);
    }
  } else if (S.phase === "slow") {
    const u = min(S.ph, S.D);
    S.phi = S.phiA + ((om * S.D) / 1.8) * (1 - ((S.D - u) / S.D) ** 1.8);
    if (S.ph >= S.D) (S.phi = 0), (S.phase = "glow"), (S.ph = 0);
  } else if (S.phase === "glow" && S.ph >= GLOW) (S.phase = "wind"), (S.ph = 0);
  else if (S.phase === "wind") {
    // Two and a half turns of the key, eased in and out.
    S.key += ((2.5 * TAU) / WIND) * 2 * (1 - abs(2 * (S.ph / WIND) - 1)) * g;
    if (S.ph >= WIND) (S.phase = "play"), (S.ph = 0), (S.tau = runFor(S.wind) - SLOW);
  }
  // Teeth ring and fade; the ripple along a tooth runs at its pitch, and
  // drags lower as the tempo falls, so the box goes flat as it stops.
  for (let i = 0; i < TEETH; i++) {
    S.ring[i] *= exp(-g / 0.5);
    S.spark[i] *= exp(-g / 0.07);
    S.wave[i] += g * (14 + 2.2 * i) * (0.35 + 0.65 * f);
  }
  // The moonlight swells a little with each note.
  let amp = 0;
  for (let i = 0; i < TEETH; i++) amp = max(amp, S.ring[i]);
  S.amp = amp * f;
  const eyeT = S.phase === "glow" ? smooth(S.ph / 0.6) : S.phase === "wind" ? 1 - smooth(S.ph / 0.7) : 0;
  S.eyes = eyeT * (0.82 + 0.18 * sin(S.t * 23) * sin(S.t * 7.7));
  // A cloud over the moon: it slides off as the box first plays, drifts back
  // as the spring runs down, covers the moon while the eyes glow and slides
  // off again while the key turns.
  const run = S.phase === "play" || S.phase === "slow" ? 1 - f : S.phase === "glow" ? 1 : 1 - smooth(S.ph / WIND);
  S.cloud = max(run, 1 - smooth(S.t / 1.2));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const rgb = S.rgb;
  const put = (x, y, c, a = 1) => {
    x = floor(x);
    y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    if (a >= 1) (rgb[o] = c[0]), (rgb[o + 1] = c[1]), (rgb[o + 2] = c[2]);
    else (rgb[o] = mix(rgb[o], c[0], a)), (rgb[o + 1] = mix(rgb[o + 1], c[1], a)), (rgb[o + 2] = mix(rgb[o + 2], c[2], a));
  };
  const line = (x0, y0, x1, y1, c) => {
    const n = max(1, Math.ceil(max(abs(x1 - x0), abs(y1 - y0))));
    for (let j = 0; j <= n; j++) put(x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n, c);
  };
  // The moonlight: a quarter of itself behind the cloud, swelling a little
  // on each note while the moon is clear.
  const cv = S.cloud, dim = 1 - 0.75 * cv + 0.15 * S.amp * (1 - cv);
  // The velvet's shades this frame: the front's sheen, the moonlit top, the
  // shelf and the lining.
  const vel = (v, sat = 0.78) => hsv(0.78 - 0.45 * S.hue, sat, v);
  const sheen = [0, 1, 2, 3].map((k) => vel(0.42 + (0.16 * k) / 3));
  const topC = [vel(0.82 * dim, 0.55), vel(0.62 * dim), vel(0.45)], shelfC = [vel(0.3, 0.7), vel(0.5, 0.7), vel(0.22, 0.7)], lining = vel(0.16, 0.85);

  // A run of one colour along a row, written straight into the frame.
  const span = (y, x0, x1, c) => {
    x0 = max(0, x0);
    x1 = min(W - 1, x1);
    for (let o = (y * W + x0) * 3, e = (y * W + x1) * 3; o <= e; o += 3) (rgb[o] = c[0]), (rgb[o + 1] = c[1]), (rgb[o + 2] = c[2]);
  };
  // The room: near-black violet, the moon peeking in at the top and its
  // cone in three bands.
  const room = [0.035, 0.012, 0.06], cone = [0.17, 0.25, 0.34].map((a) => [0.55 * a * dim + 0.03, 0.55 * a * dim + 0.01, 0.85 * a * dim + 0.05]);
  for (let y = 0; y < H; y++) span(y, 0, W - 1, room);
  for (let y = 0; y < TOP; y++) {
    const hw = 8 + 0.3 * y;
    for (let b = 0; b < 3; b++) {
      const e = [1, 0.75, 0.45][b] * hw;
      span(y, Math.ceil(SPX - e - 0.5), floor(SPX + e - 0.5), cone[b]);
    }
  }
  for (let y = 0; y < 8; y++)
    for (let x = SPX - 10; x <= SPX + 10; x++) {
      const mx = x + 0.5 - SPX, my = y + 0.5 + 3, mr = mx * mx + my * my;
      if (mr >= 100) continue;
      const crater = (mx + 3) ** 2 + (my - 3) ** 2 < 6 || (mx - 4) ** 2 + (my - 5) ** 2 < 3, c = crater ? 0.78 : mr > 80 ? 0.86 : 0.95;
      put(x, y, [c, c, c + 0.05]);
    }
  // The cloud: dark puffs with a rim lit by the moon behind them.
  const cx = round(SPX + 52 * (1 - smooth(cv)));
  for (let y = 0; y < 12; y++)
    for (let j = 0; j < 40; j++) {
      const m = S.cloudMask[y * 40 + j];
      if (m) put(cx - 20 + j, y, m === 2 ? CLOUD_RIM : CLOUD);
    }
  // Dust in the beam, drifting down and twinkling.
  for (const m of S.motes) {
    const y = (m[1] + S.t * m[2]) % 58, hw = 8 + 0.3 * y, x = SPX + (m[0] * 2 - 1) * hw * 0.85;
    const a = (0.35 + 0.35 * sin(S.t * 3 + m[3])) * dim;
    if (a > 0.2) put(x, y + 10, [0.6 + a * 0.4, 0.6 + a * 0.4, 0.75 + a * 0.25], 0.6);
  }

  // The box top, in perspective, lit in a pool round the spindle.
  for (let y = TOP; y < RIM; y++) {
    const inset = (RIM - 1 - y) * 0.6;
    for (let x = floor(BX0 + inset); x <= BX1 - inset; x++) {
      const px = (x + 0.5 - SPX) / 22, py = (y + 0.5 - 62.5) / 3.2, pool = px * px + py * py;
      put(x, y, topC[pool < 0.35 ? 0 : pool < 1 ? 1 : 2]);
    }
  }
  const brass = METALS[0][0];
  line(BX0, RIM, BX1, RIM, brass[3]);
  // The front: velvet with a sheen in four steps, brass trim at the edges.
  for (let x = BX0; x <= BX1; x++) {
    const c = sheen[min(3, floor(4 * (0.5 + 0.5 * cos((x - 14) / 9))))];
    for (let y = RIM + 1; y <= BOT; y++) put(x, y, c);
  }
  line(BX0, RIM + 1, BX0, BOT, brass[2]);
  line(BX1, RIM + 1, BX1, BOT, brass[1]);
  line(BX0, BOT, BX1, BOT, brass[1]);
  // The shelf.
  for (let y = BOT + 1; y < H; y++) span(y, 0, W - 1, shelfC[y < BOT + 4 ? 0 : y === BOT + 4 ? 1 : 2]);
  // The window: dark lining, brass frame.
  for (let y = WY0 + 1; y < WY1; y++) span(y, WX0 + 1, WX1 - 1, lining);
  line(WX0, WY0, WX1, WY0, brass[3]);
  line(WX0, WY1, WX1, WY1, brass[1]);
  line(WX0, WY0, WX0, WY1, brass[2]);
  line(WX1, WY0, WX1, WY1, brass[1]);

  // The cylinder, shaded in five steps from its highlight above the middle.
  const [metal, pinC] = METALS[S.tuneI];
  for (let y = CY - CR; y <= CY + CR - 1; y++) {
    const v = (y + 0.5 - CY) / CR, lv = v < -0.82 ? 1 : v < -0.5 ? 3 : v < -0.2 ? 4 : v < 0.45 ? 2 : v < 0.8 ? 1 : 0;
    span(y, CX0, CX1, metal[lv]);
    put(CX0 - 2, y, brass[max(0, lv - 1)]);
    put(CX0 - 1, y, brass[max(0, lv - 1)]);
    put(CX1 + 1, y, brass[max(0, lv - 1)]);
    // A gear on the right end, its teeth running with the cylinder.
    const gt = floor(y + S.beat * 3) % 2 === 0;
    put(CX1 + 2, y, brass[gt ? 3 : 1]);
  }
  // The pins: from the top edge, coming round from behind, down to the
  // bottom edge, where each one plucks its tooth.
  const pins = PINS[S.tuneI], silver = pinC, shadow = metal[0];
  for (const [b, tooth] of pins) {
    let a = b - S.beat;
    if (a < 0) a += 24;
    if (a > 12) continue;
    const y = CY + CR * cos((PI * a) / 12) - 0.5, x = TX + 3 * tooth;
    if (a > 0.6 && a < 11.4) (put(x, y + 1, shadow), put(x + 1, y + 1, shadow));
    const c = S.spark[tooth] > 0.3 && a < 0.6 ? [1, 1, 1] : silver;
    put(x, y, c);
    put(x + 1, y, c);
  }
  // The comb: a steel plate under slanted roots, a tooth for each note.
  const steel = [0.5, 0.56, 0.7], steelHi = [0.72, 0.78, 0.9], plate = [0.3, 0.33, 0.45], bright = [0.88, 0.97, 1];
  const glowC = [0.3, 0.55, 0.85], white = [1, 1, 1];
  for (let i = 0; i < TEETH; i++) {
    const x = TX + 3 * i, root = TIP + toothLen(i);
    for (let y = root; y <= PLATE; y++) for (let dx = -1; dx <= 2; dx++) put(x + dx, y, plate);
    // A ringing tooth flashes, bright and half bright bands running down it.
    const r = S.ring[i], hq = floor(r * 3) / 3;
    const tone = (c, a) => (a > 0.05 ? [mix(c[0], bright[0], a), mix(c[1], bright[1], a), mix(c[2], bright[2], a)] : c);
    const hiA = tone(steelHi, r), hiB = tone(steelHi, r / 2), loA = tone(steel, r), loB = tone(steel, r / 2);
    for (let y = TIP; y < root; y++) {
      const band = sin((y - TIP) * 1.3 - S.wave[i]) > 0;
      put(x, y, band ? hiA : hiB);
      put(x + 1, y, band ? loA : loB);
      // The ringing glows into the gaps either side, in three steps.
      if (hq > 0) (put(x - 1, y, glowC, hq * 0.8), put(x + 2, y, glowC, hq * 0.8));
    }
    if (S.spark[i] > 0.3) put(x, TIP, white), put(x + 1, TIP, white);
  }
  for (const sx of [TX + 4, TX + 31]) put(sx, PLATE - 1, brass[4]);

  // The key on the right side: a brass shaft and two wings turning about it,
  // seen edge on, so they swing between full height and a sliver.
  line(BX1 + 1, KY, KX, KY, brass[2]);
  const kc = cos(S.key), ks = abs(sin(S.key));
  for (const sg of [-1, 1]) {
    const ext = 5.5 * kc * sg, n = Math.ceil(abs(ext));
    for (let j = 1; j <= n; j++) {
      const u = j / (n + 0.5), hw = 1.6 * sin(PI * (0.25 + 0.75 * u));
      for (let dx = -1; dx <= 1; dx++) if (abs(dx) <= hw) put(KX + 1 + dx, KY - Math.sign(ext) * j, brass[ks > 0.7 ? 2 : abs(kc) > 0.7 ? 4 : 3]);
    }
  }
  put(KX + 1, KY, brass[4]);
  // While it winds, a pale green glow where a hand would be.
  if (S.phase === "wind") {
    const a = 0.45 * sin((PI * S.ph) / WIND);
    for (let y = KY - 7; y <= KY + 7; y++)
      for (let x = KX - 2; x < W; x++) {
        const e = ((x - KX - 1) / 3.5) ** 2 + ((y - KY) / 7.5) ** 2;
        if (e < 1) put(x, y, [0.35, 0.95, 0.45], a * (e < 0.4 ? 0.6 : 0.3));
      }
  }

  // The spindle and the ballerina.
  line(SPX, TOE + 1, SPX, 62, brass[3]);
  dancer(S, put, line);

  const q = (v) => (v >= 1 ? 255 : v <= 0 ? 0 : (v * 255) | 0);
  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, q(rgb[o]), q(rgb[o + 1]), q(rgb[o + 2]));
}

// The skeleton ballerina, turned by phi about her standing toe and seen a
// little from above: legs first, then the tutu, then the upper body and the
// skull from back to front.
function dancer(S, put, line) {
  const phi = S.phi, c = cos(phi), s = sin(phi), Q = { ...J, ...POSES[S.tuneI] };
  const P = (p) => {
    const x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c;
    return [SPX + 0.5 + SC * x, TOE + 0.5 - SC * (p[1] * CE - z * SE), z];
  };
  // Lit by the moon: half as bright while the cloud covers it.
  const L = 1 - 0.5 * S.cloud, lit = (c) => [c[0] * L, c[1] * L, c[2] * L];
  const bone = lit([0.96, 0.93, 0.84]), boneLo = lit([0.7, 0.66, 0.62]), pink = lit([1, 0.62, 0.75]);
  // A bone; a wide one is two LEDs thick, doubled across its length.
  const seg = (a, b, col, wide) => {
    const A = P(a), B = P(b);
    line(A[0], A[1], B[0], B[1], col);
    if (wide) abs(B[0] - A[0]) < abs(B[1] - A[1]) ? line(A[0] + 1, A[1], B[0] + 1, B[1], col) : line(A[0], A[1] + 1, B[0], B[1] + 1, col);
  };
  // Legs: the back one first.
  const legS = [[Q.toe, Q.ank, pink], [Q.ank, Q.kn, bone], [Q.kn, Q.hipS, bone]];
  const legW = [[Q.hipW, Q.knW, bone], [Q.knW, Q.ftW, bone]];
  const zW = P(Q.knW)[2];
  for (const L of zW < 0 ? [legW, legS] : [legS, legW]) for (const [a, b, col] of L) seg(a, b, col, true);
  const kn = P(Q.kn), kw = P(Q.knW);
  put(kn[0], kn[1], boneLo);
  put(kw[0], kw[1], boneLo);
  // The tutu: three layers of a scalloped disc, pleats turning with her.
  const [lilacLo, lilac, edge] = TUTUS[S.tuneI].map(lit);
  for (const [x, y, layers] of S.tutu) {
    let hit = -1;
    for (let j = 0; j < layers.length; j += 2) {
      const beta = layers[j + 1] + phi, R = TUTU_R + 0.7 * cos(12 * beta);
      if (layers[j] < R) hit = max(hit, layers[j] > R - 1.2 ? 2 : (floor(((beta + PI) / TAU) * 16) % 2 + 2) % 2);
    }
    if (hit >= 0) put(x, y, hit === 2 ? edge : hit === 1 ? lilac : lilacLo);
  }
  // The upper body, sorted back to front.
  const ribs = RIBS.map(([y, w]) => {
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const a = -PI / 2 + (PI * j) / 6;
      pts.push([w * sin(a), y - 0.4 * cos(a), 0.7 * w * cos(a)]);
    }
    return pts;
  });
  const parts = [
    { z: P(Q.chest)[2] - 0.2, draw: () => (seg(Q.waist, Q.chest, boneLo, true), seg(Q.chest, Q.neck, bone)) },
    ...ribs.map((pts) => ({ z: P(pts[3])[2], draw: () => { for (let j = 0; j < 6; j++) seg(pts[j], pts[j + 1], bone); } })),
    { z: P(Q.neck)[2], draw: () => (seg(Q.shL, Q.neck, bone), seg(Q.neck, Q.shR, bone)) },
    { z: P(Q.elL)[2], draw: () => (seg(Q.shL, Q.elL, bone, true), seg(Q.elL, Q.haL, bone)) },
    { z: P(Q.elR)[2], draw: () => (seg(Q.shR, Q.elR, bone, true), seg(Q.elR, Q.haR, bone)) },
    { z: 0.1, draw: () => skull(S, P, put, c, s) },
  ].sort((a, b) => a.z - b.z);
  for (const p of parts) p.draw();
}

// The skull: a round cranium and a narrower jaw, top lit by the moon; the
// sockets, nose and teeth sit on its face and slide round as she turns.
function skull(S, P, put, c, s) {
  const H0 = P(J.head), r = HEAD_R * SC, L = 1 - 0.5 * S.cloud, dark = [0.06, 0.02, 0.09];
  const bone = [0.96 * L, 0.93 * L, 0.84 * L], boneLo = [0.74 * L, 0.7 * L, 0.66 * L];
  for (let y = floor(H0[1] - r - 1); y <= H0[1] + r + 2; y++)
    for (let x = floor(H0[0] - r - 1); x <= H0[0] + r + 1; x++) {
      const dx = x + 0.5 - H0[0], dy = y + 0.5 - H0[1];
      const cran = dx * dx + dy * dy < r * r, jaw = dy > 0 && dy < r + 1.8 && abs(dx) < r * 0.62;
      if (cran || jaw) put(x, y, dy > r * 0.35 ? boneLo : bone);
    }
  // Face features in the head's frame: eyes, nose, the line of teeth.
  const face = (fx, fy) => {
    const p = [J.head[0] + fx, J.head[1] + fy, J.head[2] + sqrt(max(0, HEAD_R * HEAD_R - fx * fx - fy * fy * 0.6))];
    const q = P(p);
    return [q[0], q[1], -p[0] * s + p[2] * c];
  };
  const g = S.eyes, glow = [0.4, 1, 0.35], halo = [0.15, 0.6, 0.18];
  for (const ex of [-1.3, 1.3]) {
    const e = face(ex, 0.5);
    if (e[2] < 0.8) continue;
    const wide = e[2] > 2.2 ? 2 : 1;
    if (g > 0.05) for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= wide; dx++) put(e[0] + dx, e[1] + dy, halo, g * 0.55);
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx < wide; dx++) put(e[0] + dx, e[1] + dy, g > 0.05 ? [mix(dark[0], glow[0], g), mix(dark[1], glow[1], g), mix(dark[2], glow[2], g)] : dark);
  }
  const n = face(0, -1.1);
  if (n[2] > 0.8) put(n[0], n[1], dark);
  for (const tx of [-1.2, 0, 1.2]) {
    const t = face(tx, -2.6);
    if (t[2] > 0.6) put(t[0], t[1], boneLo);
  }
}
