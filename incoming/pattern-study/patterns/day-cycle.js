// ===== Patternflow pattern =====
// Title:   Day and Night
// Family:  weather
// Idea:    A house above a lake watches one whole day go by: the sun climbs and sets behind the hills, the sky runs through dusk to stars and a moon, and the windows light up for the night.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Season=0..1, Time=0.2..8, Clouds=0.15..1, Sun path=-1..1
//
// Knob 1: Season. Spring, summer, autumn and winter in turn. Summer nights have fireflies, and in winter snow falls and lies on the roof.
// Knob 2: Time. How fast the day goes, from ten minutes a day to fifteen seconds; a day takes a minute where it starts.
// Knob 3: Clouds. From a few small clouds to a sky that is nearly overcast.
// Knob 4: Sun path. How high the sun climbs, from a winter sun that skims the hills to a summer one that reaches the top.

const W = 64;
const H = 128;
// The sun and moon rise and set on this row, behind the hills.
const HORIZON = 80;
// The far edge of the lake.
const LAKE = 86;
const TW = 128;
const TH = 64;
const STARS = 56;
const FLAKES = 60;
const FLIES = 18;

// Per season: sky top, sky low, far hills, near hills, meadow, meadow shade, flowers,
// leaves, blossom, wall, roof, lake, roof cap, trunk.
const SEASONS = [
  [0x4a8ceb, 0xaad7fa, 0x6ea096, 0x4e9a5a, 0x60be46, 0x3f9634, 0xffaad2, 0x78c85a, 0xffbedc, 0xe6d7b4, 0xbe3c30, 0x3c78b4, 0xbe3c30, 0x6e4628],
  [0x286ee6, 0x8cc8fa, 0x50867a, 0x2e7a3c, 0x34a032, 0x247826, 0xffe650, 0x2e8c2e, 0x46aa3c, 0xe6d7b4, 0xbe3c30, 0x2864b4, 0xbe3c30, 0x6e4628],
  [0x5082d2, 0xc8d7eb, 0x8c8278, 0x8c6e3c, 0xc8a03c, 0x9c7a2a, 0xe65a1e, 0xeb7a1e, 0xffc83c, 0xe6d7b4, 0xa03228, 0x3c6496, 0xa03228, 0x5a3a22],
  [0x6e96d2, 0xd2e1f0, 0xaab9d2, 0x8ca0b9, 0xd2dcec, 0xaebcd2, 0xffffff, 0x466e5a, 0xe6f0fa, 0xd7c8aa, 0x8c3228, 0x5a78a0, 0xf0f5ff, 0x4a3422],
];
const NCOL = 14;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

function lattice(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const a = hash(x0 + seed, iy) * (1 - ux) + hash(x1 + seed, iy) * ux;
  const b = hash(x0 + seed, iy + 1) * (1 - ux) + hash(x1 + seed, iy + 1) * ux;
  return a * (1 - uy) + b * uy;
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Sky colours by the sun's height, from deep night to full day: top then low, as 0xRRGGBB.
const SKY_E = [-1, -0.22, -0.1, -0.02, 0.06, 0.16, 0.32];
const SKY_TOP = [0x060a26, 0x060a26, 0x141c4c, 0x2c3a82, 0x4a64b4, 0, 0];
const SKY_LOW = [0x18204e, 0x18204e, 0x5a3c78, 0xd2645a, 0xff9650, 0xffc88c, 0];

export function setup(params) {
  params.t = 0;
  // Where the day stands when the pattern starts: late afternoon, a few seconds before the sun meets the hills.
  params.phase = 0.625;
  params.cloudX = 0;
  params.pal = new Float32Array(NCOL * 3);
  params.seasons = SEASONS.map((list) => {
    const out = new Float32Array(NCOL * 3);
    list.forEach((c, i) => {
      out[i * 3] = (c >> 16) & 255;
      out[i * 3 + 1] = (c >> 8) & 255;
      out[i * 3 + 2] = c & 255;
    });
    return out;
  });
  params.buf = new Float32Array(W * H * 3);
  params.rowR = new Float32Array(H);
  params.rowG = new Float32Array(H);
  params.rowB = new Float32Array(H);
  params.light = new Float32Array(3);
  params.top = new Float32Array(3);
  params.low = new Float32Array(3);

  params.far = new Int16Array(W);
  params.mid = new Int16Array(W);
  params.near = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    params.far[x] = Math.round(61 + 9 * noise1(x * 0.06 + 1, 3) + 4 * noise1(x * 0.17 + 7, 5));
    params.mid[x] = Math.round(73 + 7 * noise1(x * 0.08 + 20, 9) + 2 * noise1(x * 0.3, 11));
    // The near shore climbs to the left, where the house stands; the lake opens out to the right.
    params.near[x] = Math.round(95 + 9 * smooth(16, 50, x) + 1.5 * noise1(x * 0.25 + 4, 13));
  }
  params.tex = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++)
      params.tex[y * TW + x] = lattice(x / 12.8, y / 8, TW / 12.8, 21) * 0.68 + lattice(x / 6.4, y / 4.5, TW / 6.4, 37) * 0.32;
  params.sx = new Int16Array(STARS);
  params.sy = new Int16Array(STARS);
  params.sb = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    params.sx[i] = Math.floor(hash(i, 71) * W);
    params.sy[i] = Math.floor(hash(i, 73) * 64);
    params.sb[i] = 0.45 + 0.55 * hash(i, 79) * hash(i, 83);
  }
  params.fx = new Float32Array(FLAKES);
  params.fy = new Float32Array(FLAKES);
  params.fs = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) {
    params.fx[i] = Math.random() * W;
    params.fy[i] = Math.random() * H;
    params.fs[i] = 0.6 + Math.random() * 0.8;
  }
  params.gx = new Float32Array(FLIES);
  params.gy = new Float32Array(FLIES);
  for (let i = 0; i < FLIES; i++) {
    params.gx[i] = Math.random() * W;
    params.gy[i] = 92 + Math.random() * 32;
  }
  // Flowers in the meadow, fixed, more of them nearer.
  params.fl = new Int16Array(70 * 2);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 91) * W);
    const y = params.near[x] + 3 + Math.floor(Math.pow(hash(i, 93), 0.7) * (H - params.near[x] - 4));
    params.fl[i * 2] = x;
    params.fl[i * 2 + 1] = y;
  }
}

function mixHex(out, a, b, u) {
  out[0] = ((a >> 16) & 255) * (1 - u) + ((b >> 16) & 255) * u;
  out[1] = ((a >> 8) & 255) * (1 - u) + ((b >> 8) & 255) * u;
  out[2] = (a & 255) * (1 - u) + (b & 255) * u;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0.15, 0.06];
  dt = Math.min(dt, 0.1);
  params.t += dt;
  // A day lasts 120 / Time seconds: a minute where the knob starts. The clock slows round
  // sunrise and sunset and hurries through noon and midnight, so the colours get the time.
  const e = Math.sin((params.phase - 0.25) * Math.PI * 2);
  const pace = (0.55 + 0.9 * Math.abs(e)) / 1.123;
  params.phase = (params.phase + (dt * Math.max(0.05, k[1]) * pace) / 120) % 1;
  params.cloudX += dt * (0.9 + 0.25 * k[1]);
  params.season = Math.max(0, Math.min(1, k[0]));
  params.clouds = k[2];
  params.arc = 46 + 28 * Math.max(-1, Math.min(1, k[3]));

  // Season: four palettes in a row, each held a while before it turns into the next.
  const q = params.season * 3;
  const a = Math.min(2, Math.floor(q));
  const m = smooth(0.2, 0.8, q - a);
  const pa = params.seasons[a];
  const pb = params.seasons[a + 1];
  for (let i = 0; i < NCOL * 3; i++) params.pal[i] = pa[i] * (1 - m) + pb[i] * m;
  params.snow = smooth(0.78, 0.95, params.season);
  // Summer nights have fireflies.
  params.summer = Math.max(0, 1 - Math.abs(params.season - 0.33) / 0.16);

  if (params.snow > 0) {
    for (let i = 0; i < FLAKES; i++) {
      params.fy[i] += dt * 7 * params.fs[i];
      params.fx[i] += dt * (Math.sin(params.t * 0.9 + i * 1.7) * 3 + 1.2);
      if (params.fy[i] > H) {
        params.fy[i] -= H + 2;
        params.fx[i] = Math.random() * W;
      }
      if (params.fx[i] >= W) params.fx[i] -= W;
    }
  }
  if (params.summer > 0) {
    for (let i = 0; i < FLIES; i++) {
      params.gx[i] += dt * (noise1(params.t * 0.4 + i * 9.3, 17) - 0.5) * 8;
      params.gy[i] += dt * (noise1(params.t * 0.35 + i * 5.1, 19) - 0.5) * 6;
      if (params.gx[i] < 0) params.gx[i] += W;
      if (params.gx[i] >= W) params.gx[i] -= W;
      params.gy[i] = Math.max(88, Math.min(H - 2, params.gy[i]));
    }
  }
}

// One soft point spread over its 2x2 neighbours, so it glides instead of hopping LED to LED.
function splat(buf, x, y, r, g, b) {
  const x0 = Math.floor(x - 0.5);
  const y0 = Math.floor(y - 0.5);
  const fx = x - 0.5 - x0;
  const fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const wy = j === 0 ? 1 - fy : fy;
    for (let i = 0; i < 2; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const w = wy * (i === 0 ? 1 - fx : fx);
      const o = (yy * W + xx) * 3;
      buf[o] = buf[o] * (1 - w) + Math.max(buf[o], r) * w;
      buf[o + 1] = buf[o + 1] * (1 - w) + Math.max(buf[o + 1], g) * w;
      buf[o + 2] = buf[o + 2] * (1 - w) + Math.max(buf[o + 2], b) * w;
    }
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  const pal = params.pal;
  const p = params.phase;
  const t = params.t;
  // The sun's height, -1 at midnight to 1 at noon. It crosses the panel at an even pace and climbs on a sine.
  const e = Math.sin((p - 0.25) * Math.PI * 2);
  const dayU = (p - 0.25) / 0.5;
  const sunX = 4 + 56 * dayU;
  const sunY = HORIZON - e * params.arc;
  const nightU = ((p + 0.25) % 1) / 0.5;
  const moonX = 4 + 56 * nightU;
  const moonY = HORIZON + e * params.arc * 0.85;
  const cover = params.clouds;
  // How high the sun really stands. A low arc gives a weaker, warmer day from morning to evening.
  const el = e > 0 ? e * (0.45 + (0.55 * (params.arc - 18)) / 56) : e;

  // Daylight on the land: full by day, warm as the sun gets low, moonlit blue at night.
  const day = smooth(-0.14, 0.22, el);
  const gold = smooth(-0.08, 0.04, el) * (1 - smooth(0.18, 0.42, el));
  // Cloud dims the land, and so does a low sun in front of us: the near side of everything is in shade.
  const dim = (1 - cover * 0.3) * (1 - gold * 0.22);
  const light = params.light;
  // The warm cast stays light: a dim orange hill reads as brown on the panel.
  light[0] = (day * (1 + gold * 0.08) + (1 - day) * 0.3) * dim;
  light[1] = (day * (1 - gold * 0.08) + (1 - day) * 0.34) * dim;
  light[2] = (day * (1 - gold * 0.3) + (1 - day) * 0.58) * dim;

  // Sky: the keyframe pair for this sun height, then a gradient down to the horizon.
  let s = 0;
  while (s < SKY_E.length - 2 && el > SKY_E[s + 1]) s++;
  const u = smooth(SKY_E[s], SKY_E[s + 1], el);
  const top = params.top;
  const low = params.low;
  const topA = SKY_TOP[s] || hexOf(pal, 0);
  const topB = SKY_TOP[s + 1] || hexOf(pal, 0);
  const lowA = SKY_LOW[s] || hexOf(pal, 1);
  const lowB = SKY_LOW[s + 1] || hexOf(pal, 1);
  mixHex(top, topA, topB, u);
  mixHex(low, lowA, lowB, u);
  // Cloud cover greys the sky.
  const grey = cover * cover * 0.55;
  const avgT = (top[0] + top[1] + top[2]) / 3;
  const avgL = (low[0] + low[1] + low[2]) / 3;
  for (let c = 0; c < 3; c++) {
    top[c] = top[c] * (1 - grey) + avgT * grey * 0.9;
    low[c] = low[c] * (1 - grey) + avgL * grey * 0.9;
  }
  for (let y = 0; y < LAKE; y++) {
    const v = Math.pow(Math.min(1, y / HORIZON), 1.6);
    params.rowR[y] = top[0] + (low[0] - top[0]) * v;
    params.rowG[y] = top[1] + (low[1] - top[1]) * v;
    params.rowB[y] = top[2] + (low[2] - top[2]) * v;
  }
  // The glow round a low sun, warm, spread wide along the horizon.
  const glowK = (0.2 + 0.7 * gold) * (1 - cover * 0.6) * smooth(-0.2, 0, el);
  for (let y = 0; y < LAKE; y++) {
    const o0 = y * W * 3;
    const dy = (y - sunY) * 1.4;
    const r0 = params.rowR[y];
    const g0 = params.rowG[y];
    const b0 = params.rowB[y];
    const c = 140 * glowK;
    const d0 = 140 + dy * dy;
    for (let x = 0; x < W; x++) {
      const dx = x - sunX;
      const g = c / (d0 + dx * dx);
      const o = o0 + x * 3;
      // Blended toward warm rather than added, so a bright sky does not burn white round the sun.
      buf[o] = r0 + (255 - r0) * g;
      buf[o + 1] = g0 + (178 - g0) * g;
      buf[o + 2] = b0 + (84 - b0) * g * 0.8;
    }
  }

  // Stars come out as the sky darkens; a few twinkle.
  const starVis = smooth(-0.04, -0.2, e);
  if (starVis > 0) {
    for (let i = 0; i < STARS; i++) {
      const x = params.sx[i];
      const y = params.sy[i];
      const b = starVis * params.sb[i] * (0.75 + 0.25 * Math.sin(t * (2 + i * 0.13) + i));
      const o = (y * W + x) * 3;
      buf[o] = Math.max(buf[o], 200 * b);
      buf[o + 1] = Math.max(buf[o + 1], 210 * b);
      buf[o + 2] = Math.max(buf[o + 2], 255 * b);
    }
  }

  // The sun: a hard disc, yellow-white high up, orange as it nears the hills.
  if (e > -0.12) {
    const low = 1 - smooth(0.05, 0.4, el);
    const sr = 255;
    const sg = 238 - 88 * low;
    const sb = 150 - 110 * low;
    disc(buf, sunX, sunY, 3.6, sr, sg, sb);
  }
  // The moon: a pale crescent, with the dark side cut away by a second disc.
  if (e < 0.12) {
    const mv = smooth(0.12, -0.05, e);
    moon(buf, moonX, moonY, mv);
  }

  // Clouds: a baked texture drifting left to right, cut at a level set by Clouds.
  const tex = params.tex;
  const thr = 0.78 - 0.5 * cover;
  const cx0 = params.cloudX;
  const ix = Math.floor(cx0);
  const fx = cx0 - ix;
  const base = ((ix % TW) + TW) % TW;
  // White by day and greyer the more of them there are, salmon while the sun is low, slate under the moon.
  const lit = Math.max(day, gold);
  const grey2 = 1 - cover * 0.28;
  // A heavy sky is grey even at sunset.
  const pink = gold * (1 - cover * 0.65);
  const cr = 58 * (1 - lit) + (228 * grey2 * (1 - pink) + 255 * pink) * lit;
  const cg = 62 * (1 - lit) + (230 * grey2 * (1 - pink) + 178 * pink) * lit;
  const cbb = 96 * (1 - lit) + (236 * grey2 * (1 - pink) + 172 * pink) * lit;
  for (let y = 2; y < 62; y++) {
    const band = smooth(2, 12, y) * (1 - smooth(44, 62, y));
    if (band <= 0) continue;
    const row = y * TW;
    const up = (y - 2) * TW;
    const bandUp = smooth(2, 12, y - 2) * (1 - smooth(44, 62, y - 2));
    for (let x = 0; x < W; x++) {
      let xa = base - x;
      if (xa < 0) xa += TW;
      const xb = xa + 1 === TW ? 0 : xa + 1;
      const n = (tex[row + xa] * (1 - fx) + tex[row + xb] * fx) * (0.55 + 0.45 * band);
      const a = smooth(thr, thr + 0.07, n);
      if (a <= 0) continue;
      // Where the cloud is thicker just above, this is its underside, and a shade darker.
      const nUp = (tex[up + xa] * (1 - fx) + tex[up + xb] * fx) * (0.55 + 0.45 * bandUp);
      const lift = 0.86 + 0.14 * Math.max(-1, Math.min(1, (n - nUp) * 9));
      const o = (y * W + x) * 3;
      buf[o] = buf[o] * (1 - a) + cr * lift * a;
      buf[o + 1] = buf[o + 1] * (1 - a) + cg * lift * a;
      buf[o + 2] = buf[o + 2] * (1 - a) + cbb * lift * a;
    }
  }

  // Hills: the far ones hazed toward the sky, the near ones in their own colour. With the
  // sun low behind them they go to a cool silhouette instead of a lit brown.
  const lr = light[0];
  const lg = light[1];
  const lb = light[2];
  const back = gold * 0.7;
  for (let x = 0; x < W; x++) {
    for (let y = params.far[x]; y < LAKE; y++) {
      const o = (y * W + x) * 3;
      const near = y >= params.mid[x];
      const ci = near ? 3 : 2;
      const haze = near ? 0.12 : 0.4 * (1 - back * 0.5);
      const dark = near ? back * 0.75 : back;
      buf[o] = ((pal[ci * 3] * (1 - haze) + low[0] * haze) * lr) * (1 - dark) + 46 * dark;
      buf[o + 1] = ((pal[ci * 3 + 1] * (1 - haze) + low[1] * haze) * lg) * (1 - dark) + 50 * dark;
      buf[o + 2] = ((pal[ci * 3 + 2] * (1 - haze) + low[2] * haze) * lb) * (1 - dark) + 84 * dark;
    }
  }

  // The lake mirrors what is above it, darker and bluer, broken by a slow shimmer.
  const wr = pal[33] * 0.18 * lr;
  const wg = pal[34] * 0.18 * lg;
  const wb = pal[35] * 0.2 * lb;
  for (let y = LAKE; y < H; y++) {
    // Squeezed upward, so the water shows the sky over the hills as well as the hills.
    const my = Math.round(LAKE - 1 - (y - LAKE) * 1.7);
    if (my < 0) break;
    const wob = Math.sin(y * 1.3 + t * 1.6) * 0.6;
    for (let x = 0; x < W; x++) {
      if (y >= params.near[x]) continue;
      let sx = Math.round(x + wob * Math.sin(x * 0.4 + y));
      if (sx < 0) sx = 0;
      if (sx >= W) sx = W - 1;
      const so = (my * W + sx) * 3;
      const o = (y * W + x) * 3;
      buf[o] = buf[so] * 0.55 + wr;
      buf[o + 1] = buf[so + 1] * 0.6 + wg;
      buf[o + 2] = buf[so + 2] * 0.66 + wb;
    }
  }
  // A path of glitter under the sun or the moon, on the water.
  const glitSun = e > -0.02 ? (1 - smooth(0.2, 0.6, el)) * (1 - cover * 0.7) : 0;
  const glitMoon = e < -0.05 ? smooth(-0.05, -0.25, e) * 0.5 : 0;
  const gx = glitSun > 0 ? sunX : moonX;
  const gk = Math.max(glitSun, glitMoon);
  if (gk > 0.02) {
    for (let y = LAKE + 1; y < 108; y++) {
      // Each row of water holds one short dash that slides to and fro about the light's line.
      const half = 0.8 + (y - LAKE) * 0.12 + 0.8 * Math.sin(y * 2.3 + t * 2.1);
      const mid = gx + Math.sin(y * 3.7 + t * 1.3) * (1 + (y - LAKE) * 0.08);
      // A weak light breaks the path into fewer dashes rather than dimmer ones.
      if (Math.sin(y * 5.1 + t * 2.7) < 1.2 - 1.6 * gk) continue;
      for (let x = Math.max(0, Math.round(mid - half)); x <= Math.min(W - 1, Math.round(mid + half)); x++) {
        if (y >= params.near[x]) continue;
        const o = (y * W + x) * 3;
        // Never dimmer than about two thirds: a dim gold dash on the water reads as tan.
        const b = 0.62 + 0.38 * gk;
        buf[o] = Math.max(buf[o], (glitSun > 0 ? 255 : 200) * b);
        buf[o + 1] = Math.max(buf[o + 1], (glitSun > 0 ? 226 : 210) * b);
        buf[o + 2] = Math.max(buf[o + 2], (glitSun > 0 ? 150 : 240) * b);
      }
    }
  }

  // The near meadow, a shade darker toward us, with its flowers.
  for (let x = 0; x < W; x++) {
    for (let y = params.near[x]; y < H; y++) {
      const v = smooth(params.near[x], H, y);
      const o = (y * W + x) * 3;
      buf[o] = (pal[12] * (1 - v) + pal[15] * v) * lr;
      buf[o + 1] = (pal[13] * (1 - v) + pal[16] * v) * lg;
      buf[o + 2] = (pal[14] * (1 - v) + pal[17] * v) * lb;
    }
  }
  for (let i = 0; i < 70; i++) {
    const o = (params.fl[i * 2 + 1] * W + params.fl[i * 2]) * 3;
    buf[o] = pal[18] * lr;
    buf[o + 1] = pal[19] * lg;
    buf[o + 2] = pal[20] * lb;
  }

  tree(buf, pal, params, 27, light);
  house(buf, pal, params, light, el, p);

  const flies = params.summer * (1 - day);
  if (flies > 0.02) {
    for (let i = 0; i < FLIES; i++) {
      const blink = Math.max(0, Math.sin(t * (1.3 + i * 0.07) + i * 2.4));
      const b = flies * blink * blink;
      if (b < 0.05) continue;
      // Drawn past full so the point is still bright once it is shared out over four LEDs.
      splat(buf, params.gx[i], params.gy[i], 330 * b, 400 * b, 120 * b);
    }
  }
  if (params.snow > 0.02) {
    // Snow catches whatever light there is: white by day, blue under the moon.
    const k = params.snow;
    for (let i = 0; i < FLAKES; i++) {
      const v = k * (0.65 + 0.35 * params.fs[i] / 1.4);
      splat(buf, params.fx[i], params.fy[i], 250 * v * Math.min(1, lr * 1.3), 250 * v * Math.min(1, lg * 1.3), 255 * v * Math.min(1, lb * 1.3));
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
  }
}

function hexOf(pal, i) {
  return (Math.round(pal[i * 3]) << 16) | (Math.round(pal[i * 3 + 1]) << 8) | Math.round(pal[i * 3 + 2]);
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
}

// A disc with a one-LED soft rim, so it moves without stepping. The hills, drawn after it, hide it as it sets.
function disc(buf, cx, cy, r, cr, cg, cb) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(HORIZON + 2, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const a = Math.max(0, Math.min(1, r - Math.sqrt(px * px + py * py) + 0.5));
      if (a <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] = buf[o] * (1 - a) + cr * a;
      buf[o + 1] = buf[o + 1] * (1 - a) + cg * a;
      buf[o + 2] = buf[o + 2] * (1 - a) + cb * a;
    }
}

function moon(buf, cx, cy, k) {
  const r = 3.2;
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(HORIZON + 2, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const d = Math.sqrt(px * px + py * py);
      const cut = Math.sqrt((px + 2.4) * (px + 2.4) + (py - 1) * (py - 1));
      const a = Math.max(0, Math.min(1, r - d + 0.5)) * Math.max(0, Math.min(1, cut - r + 0.5)) * k;
      if (a <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] = buf[o] * (1 - a) + 240 * a;
      buf[o + 1] = buf[o + 1] * (1 - a) + 236 * a;
      buf[o + 2] = buf[o + 2] * (1 - a) + 205 * a;
    }
}

function tree(buf, pal, params, tx, light) {
  const base = params.near[tx] + 1;
  const lr = light[0];
  const lg = light[1];
  const lb = light[2];
  for (let y = base - 7; y < base; y++) {
    put(buf, tx, y, pal[39] * lr, pal[40] * lg, pal[41] * lb);
    put(buf, tx + 1, y, pal[39] * lr * 0.8, pal[40] * lg * 0.8, pal[41] * lb * 0.8);
  }
  const cy = base - 12;
  for (let y = cy - 6; y <= cy + 5; y++)
    for (let x = tx - 6; x <= tx + 7; x++) {
      const dx = (x - tx - 0.5) / 6.2;
      const dy = (y - cy) / 5.6;
      const edge = 0.12 * Math.sin(x * 2.1 + y * 1.3);
      if (dx * dx + dy * dy > 1 + edge) continue;
      // The side away from the light is a shade darker, and the crown is speckled with blossom or fruit.
      const shade = 0.78 + 0.22 * smooth(1, -1, dx + dy);
      const dot = hash(x * 7 + 3, y * 5 + 1) < 0.18;
      const c = dot ? 24 : 21;
      put(buf, x, y, pal[c] * shade * lr, pal[c + 1] * shade * lg, pal[c + 2] * shade * lb);
    }
}

function house(buf, pal, params, light, e, p) {
  const hx = 5;
  const g = params.near[hx + 5] + 1;
  const lr = light[0];
  const lg = light[1];
  const lb = light[2];
  const snow = params.snow;
  // Walls.
  for (let y = g - 7; y < g; y++)
    for (let x = hx; x < hx + 11; x++) {
      const side = x >= hx + 8 ? 0.82 : 1;
      put(buf, x, y, pal[27] * lr * side, pal[28] * lg * side, pal[29] * lb * side);
    }
  // Roof: a triangle a little wider than the walls, with snow along its edge in winter.
  for (let r = 0; r < 7; r++) {
    const y = g - 8 - r;
    const half = 6.5 - r;
    for (let x = Math.ceil(hx + 5 - half); x <= Math.floor(hx + 5 + half); x++) {
      const rim = r === 6 || Math.abs(x - (hx + 5)) >= half - 1;
      const cap = rim ? snow : snow * 0.35;
      const ri = pal[30] * (1 - cap) + pal[36] * cap;
      const gi = pal[31] * (1 - cap) + pal[37] * cap;
      const bi = pal[32] * (1 - cap) + pal[38] * cap;
      put(buf, x, y, ri * lr, gi * lg, bi * lb);
    }
  }
  // Chimney.
  for (let y = g - 14; y < g - 10; y++) put(buf, hx + 8, y, 120 * lr, 70 * lg, 60 * lb);
  // Door.
  for (let y = g - 4; y < g; y++) put(buf, hx + 5, y, pal[39] * lr, pal[40] * lg, pal[41] * lb);
  // Windows: dark glass by day; one by one they light up at dusk, and one goes out after midnight.
  const night = p > 0.5 ? p - 1 : p;
  for (let i = 0; i < 2; i++) {
    const wx = hx + (i === 0 ? 2 : 7);
    const at = i === 0 ? 0.05 : 0;
    let on = smooth(at + 0.03, at - 0.03, e);
    // The left window goes dark from about one in the morning until five.
    if (i === 0 && night > 0.04 && night < 0.2) on = 0;
    const wr = 50 * lr * (1 - on) + 255 * on;
    const wg = 70 * lg * (1 - on) + 196 * on;
    const wb = 90 * lb * (1 - on) + 90 * on;
    put(buf, wx, g - 5, wr, wg, wb);
    put(buf, wx + 1, g - 5, wr, wg, wb);
    put(buf, wx, g - 4, wr, wg, wb);
    put(buf, wx + 1, g - 4, wr, wg, wb);
  }
}
