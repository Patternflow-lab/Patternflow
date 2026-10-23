// ===== Patternflow pattern =====
// Title:   Foxfire
// Family:  fungi
// Idea:    A night forest floor in cross-section, a broken stump and a rotting log on the leaf litter over the soil, where glowing honey fungus threads creep and branch through wood and earth with pulses of light running out along them, while clusters of little glowing mushrooms come up, breathe their light and shed spores that drift up into the dark.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after the foxfire of Armillaria-rotted wood and the glowing caps of Mycena chlorophos and Panellus stipticus
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Glow=0..1, Speed=0.2..3, Spores=0..1, Damp=0..1
//
// Knob 1: Glow. The colour of the light, from the yellow-green of foxfire at 0 through a clear green to a cold blue-green at 1.
// Knob 2: Speed. How fast the floor lives: at 2 a thread tip creeps about three LEDs a second, a pulse runs seven LEDs a second and a mushroom cluster comes and goes in about forty seconds; at 0.2 all of it runs ten times slower.
// Knob 3: Spores. How hard the caps shed: at 0 a few motes rise from each cluster; turned up, the spores thicken into a lit haze that climbs past the stump into the top of the panel.
// Knob 4: Damp. How wet the wood is; wet foxfire glows harder, so turning it up brightens the threads and the caps and lights more of the rotten wood round them.
// Buttons: K1 tap shakes the floor: every cap that is up lets go a puff of spores at once.

const W = 64;
const H = 128;
const N = W * H;

// What each LED of the floor is made of. Threads grow in wood, roots, litter
// and soil, never in the air, the stones or the bark.
const AIR = 0;
const BARK = 1;
const WOOD = 2;
const LITTER = 3;
const SOIL = 4;
const STONE = 5;
const ROOT = 6;
const GROWS = [0, 0, 1, 1, 1, 0, 1];

// The ground line, the stump's middle column, and the log lying beside it
// from its broken end at LOGX out past the right edge.
const GROUND = 64;
const SX = 12;
const LOGX = 27;
const LOGY = 51;
const LOGR = 10.5;

// Thread tips alive at once, LEDs each one creeps per second of floor time,
// the chance per step that a tip forks, and how long a thread lives before
// it rots away, in seconds of floor time (plus up to LIFE_J more).
const TIPS = 26;
const CREEP = 3;
const FORK = 0.08;
const LIFE = 16;
const LIFE_J = 8;
// A pulse every WAVE LEDs along a thread, running at RUN LEDs a second.
const WAVE = 26;
const RUN = 7;
// Seconds of floor time grown before the panel opens.
const PRE = 26;
const PRE_DT = 1 / 15;
// Where fresh threads start: the stump, the log and the soil.
const ORIGINS = [
  [12, 68], [9, 46], [14, 26], [11, 12], [12, 36], [34, 50], [46, 54], [58, 48], [30, 86], [50, 100], [42, 120], [10, 110],
];

const MAXS = 900;
// The spore haze is kept on a grid of 4 x 4 LED cells.
const HW = 17;
const HH = 33;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// The spores draw from their own sequence, so how many there are never
// changes the way the threads grow.
function sporeRandom(P) {
  P.seed = (P.seed + 0x6d2b79f5) | 0;
  let t = P.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function noise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const fu = u * u * (3 - 2 * u);
  const fv = v * v * (3 - 2 * v);
  const k = xi + s * 7919;
  const a = hash(k, yi);
  const b = hash(k + 1, yi);
  const c = hash(k, yi + 1);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + hash(k + 1, yi + 1)) * fu * fv;
}

function groundY(x) {
  return GROUND - 0.5 + 1.5 * Math.sin(x * 0.17 + 0.5) + Math.sin(x * 0.41);
}

// The stump's half width at a row, flaring into its roots at the foot, and
// the row its broken top reaches at a column.
function stumpHalf(y) {
  return 7 + 5 * smooth(GROUND - 16, GROUND + 6, y) ** 2;
}

function stumpTop(x) {
  return 5 + 6 * Math.abs(Math.sin(x * 0.75 + 0.4)) + 3 * hash(x, 77) + 4 * smooth(4, 0, Math.abs(x - SX) - 4);
}

function logCentre(x) {
  return LOGY + 0.05 * (x - LOGX);
}

// The glow colours Glow runs through: foxfire yellow-green, green, sea
// green, a cold blue.
const HUES = [
  [150, 255, 40],
  [50, 255, 100],
  [20, 235, 200],
  [30, 150, 255],
];

function hueOf(k, out) {
  const u = clamp(k, 0, 1) * (HUES.length - 1);
  const i = Math.min(HUES.length - 2, Math.floor(u));
  const f = u - i;
  for (let c = 0; c < 3; c++) out[c] = (HUES[i][c] * (1 - f) + HUES[i + 1][c] * f) / 255;
}

// Paints the floor once: what each LED is, its colour in the dark (kept under
// 24) and how rotten it is there.
function build(P) {
  const { kind, base, rot } = P;
  const put = (p, k, r, g, b) => {
    kind[p] = k;
    base[p * 3] = r;
    base[p * 3 + 1] = g;
    base[p * 3 + 2] = b;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const gy = groundY(x);
      if (y < gy) {
        // Night air under the trees, with two far trunks a shade lighter.
        const h = y / gy;
        const trunk = smooth(1.5, 0, Math.abs(x - 41 - 2 * Math.sin(y * 0.03)) - 2.5) + smooth(1.5, 0, Math.abs(x - 58) - 1.5);
        const n = noise(x * 0.5, y * 0.12, 1);
        put(p, AIR, 2 + 2 * h + 4 * trunk * n, 3 + 3 * h + 4 * trunk * n, 8 + 2 * h + 3 * trunk);
      } else if (y < gy + 8) {
        // Leaf litter between the leaves.
        const v = 0.5 + 0.4 * noise(x * 0.6, y * 0.6, 17);
        put(p, LITTER, 12 * v, 8 * v, 4 * v);
      } else {
        // Soil: dark, mottled, darker with depth.
        const m = 0.55 + 0.6 * noise(x * 0.35, y * 0.35, 2) - (0.3 * (y - gy)) / 64;
        put(p, SOIL, 15 * m, 10 * m, 6 * m);
      }
    }
  // Stones in the soil, lit on top.
  for (const [cx, cy, rx, ry] of [[37, 84, 5, 3], [53, 101, 6, 4], [20, 104, 4, 3], [61, 77, 3, 2.5], [5, 84, 3, 2], [33, 118, 5, 3.5], [58, 122, 4, 3]]) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (x < 0 || x >= W || y >= H) continue;
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (e > 1) continue;
        const top = 1 - (y - cy + ry) / (2 * ry);
        const v = 8 + 9 * top * top;
        put(y * W + x, STONE, v, v, v + 2);
      }
  }
  // Roots from the foot of the stump down into the soil.
  for (const [x0, a0, len, w0] of [[4, 2.2, 40, 2.4], [10, 1.75, 52, 2.6], [17, 1.25, 50, 2.4], [22, 0.6, 36, 1.8], [1, 2.6, 22, 1.6]]) {
    let x = x0;
    let y = GROUND + 4;
    let a = a0;
    for (let s = 0; s < len; s++) {
      a += 0.12 * Math.sin(s * 0.35 + x0);
      x += Math.cos(a);
      y += Math.sin(a) * 0.9 + 0.15;
      const r = w0 * (1 - s / (len + 6));
      for (let j = Math.floor(y - r); j <= y + r; j++)
        for (let i = Math.floor(x - r); i <= x + r; i++) {
          if (i < 0 || i >= W || j < 0 || j >= H || (i - x) ** 2 + (j - y) ** 2 > r * r) continue;
          const q = j * W + i;
          if (kind[q] !== SOIL) continue;
          const v = 0.8 + 0.3 * noise(i * 0.8, j * 0.3, 4);
          put(q, ROOT, 18 * v, 11 * v, 7 * v);
          // Stretches of root sheathed in fungus glow faintly.
          rot[q] = 0.75 * noise(s * 0.15, x0, 25);
        }
    }
  }
  // The log, lying with its broken end to the left: bark top and bottom, the
  // rotten wood bared along its middle, the end face showing its rings.
  for (let y = 0; y < H; y++)
    for (let x = LOGX - 5; x < W; x++) {
      const p = y * W + x;
      const v = (y - logCentre(x)) / LOGR;
      if (Math.abs(v) > 1) continue;
      const face = ((x - LOGX) / 4) ** 2 + v * v;
      if (x < LOGX && face > 1) continue;
      const round = Math.sqrt(1 - v * v);
      if (face <= 1) {
        // End face: rings round the heart, the heart rotted soft.
        const ring = Math.sqrt(face) * 6;
        const line = Math.abs(ring - Math.round(ring)) < 0.18 ? 0.6 : 1;
        const s = (0.7 + 0.3 * noise(x * 0.9, y * 0.5, 5)) * line;
        put(p, WOOD, 20 * s, 15 * s, 9 * s);
        rot[p] = (0.75 + 0.25 * (1 - Math.sqrt(face))) * (line < 1 ? 0.5 : 1);
        continue;
      }
      const n = noise(x * 0.18, y * 0.5, 6);
      const barkEdge = 0.58 + 0.3 * n;
      if (Math.abs(v) > barkEdge) {
        // Bark in long ridges along the log, moss on its top.
        const ridge = 0.6 + 0.4 * Math.abs(Math.sin(y * 1.7 + 2 * noise(x * 0.25, y, 7)));
        const s = ridge * (0.45 + 0.55 * round);
        const moss = v < 0 ? smooth(0.5, 0.8, noise(x * 0.3, y * 0.6, 8)) * smooth(-0.6, -0.95, v) : 0;
        put(p, BARK, (14 - 8 * moss) * s, (10 + 6 * moss) * s, (7 - 3 * moss) * s);
      } else {
        // Bared wood with its grain along the log and a few cracks across it.
        const grain = 0.75 + 0.25 * Math.sin(y * 2.3 + 3 * noise(x * 0.1, y * 0.3, 9));
        const crack = smooth(0.08, 0, Math.abs(noise(x * 0.22, 3, 10) - 0.5)) * 0.6;
        const s = grain * (1 - crack) * (0.55 + 0.45 * round);
        put(p, WOOD, 21 * s, 16 * s, 9 * s);
        rot[p] = smooth(0.35, 0.75, noise(x * 0.22, y * 0.35, 11)) * (1 - crack);
      }
    }
  // The stump: bark down both sides and in patches, the rest bared and rotten.
  for (let y = 0; y < H; y++) {
    const half = stumpHalf(y);
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - SX);
      if (dx > half || y < stumpTop(x) || y > groundY(x) + 1) continue;
      const p = y * W + x;
      const edge = half - dx;
      const round = Math.sqrt(1 - (dx / (half + 0.5)) ** 2);
      const patch = noise(x * 0.3, y * 0.09, 12);
      if (edge < 1.6 + 1.2 * noise(1, y * 0.2, 13) || patch > 0.8) {
        const fissure = 0.55 + 0.45 * Math.abs(Math.sin(x * 1.9 + 2 * noise(x, y * 0.15, 14)));
        const s = fissure * (0.5 + 0.5 * round);
        put(p, BARK, 15 * s, 10 * s, 7 * s);
      } else {
        const grain = 0.75 + 0.25 * Math.sin(x * 2.1 + 3 * noise(x * 0.4, y * 0.08, 15));
        const s = grain * (0.55 + 0.45 * round);
        put(p, WOOD, 20 * s, 15 * s, 9 * s);
        rot[p] = smooth(0.28, 0.68, noise(x * 0.32, y * 0.11, 16)) * (0.8 + 0.2 * smooth(20, 10, y));
      }
    }
  }
  // Fallen leaves over the soil and round the foot of the log and the stump,
  // oak brown, beech copper, a few still olive.
  const LEAVES = [[19, 10, 4], [15, 12, 4], [21, 13, 6], [11, 8, 4], [17, 9, 3], [13, 13, 6]];
  for (let i = 0; i < 170; i++) {
    const x0 = hash(i, 19) * W;
    const gy = groundY(x0);
    const y0 = gy - 1 + hash(i, 20) * 9;
    const a = hash(i, 21) * 3.14;
    const rx = 1.6 + 1.6 * hash(i, 22);
    const ry = 0.7 + 0.6 * hash(i, 23);
    const col = LEAVES[Math.floor(hash(i, 24) * LEAVES.length)];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let y = Math.floor(y0 - rx); y <= y0 + rx; y++)
      for (let x = Math.floor(x0 - rx); x <= x0 + rx; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H || y < groundY(x) - 1.5) continue;
        const u = ((x - x0) * ca + (y - y0) * sa) / rx;
        const w = (-(x - x0) * sa + (y - y0) * ca) / ry;
        if (u * u + w * w > 1) continue;
        const s = (Math.abs(w) < 0.3 ? 0.7 : 1) * (0.8 + 0.2 * hash(x, y));
        put(y * W + x, LITTER, col[0] * s, col[1] * s, col[2] * s);
        // One leaf in five is grown through and glows, the way leaf litter
        // full of Mycena does.
        rot[y * W + x] = hash(i, 26) < 0.2 ? 0.55 + 0.3 * hash(i, 27) : 0;
      }
  }
  // Every LED of the dark gets its own grain, channel by channel, and nothing
  // in the dark goes over 23.
  for (let p = 0; p < N; p++) {
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const v = Math.max(0, base[p * 3 + c] + 7 * (hash(p, 30 + c) - 0.5));
      base[p * 3 + c] = v;
      if (v > m) m = v;
    }
    if (m > 23) for (let c = 0; c < 3; c++) base[p * 3 + c] *= 23 / m;
  }
}

// Mushroom clusters: Mycena standing up on stems, or Panellus shelves on the
// side of the wood (side -1 or 1). Each comes up, glows and goes.
function makeSites() {
  const sites = [];
  const up = (x, y, n, tall) => sites.push({ x, y, side: 0, n, tall });
  const shelf = (x, y, side, n) => sites.push({ x, y, side, n, tall: 0 });
  up(11, Math.ceil(stumpTop(11)), 6, 7);
  up(5, Math.ceil(stumpTop(5)), 3, 4);
  shelf(SX + 8, 28, 1, 3);
  shelf(SX - 8, 42, -1, 3);
  up(39, Math.floor(logCentre(39) - LOGR * 0.92), 5, 6);
  up(55, Math.floor(logCentre(55) - LOGR * 0.92), 4, 5);
  shelf(LOGX - 5, 49, -1, 2);
  up(31, Math.floor(groundY(31)), 3, 3);
  up(47, Math.floor(groundY(47)) + 1, 3, 3);
  up(61, Math.floor(groundY(61)), 2, 3);
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    s.period = 34 + 14 * hash(i, 40);
    s.offset = s.period * hash(i, 41);
    s.beat = 3.2 + 2.4 * hash(i, 42);
    s.phase = 6.28 * hash(i, 43);
    s.caps = [];
    for (let j = 0; j < s.n; j++) {
      if (s.side === 0) {
        // Neighbours stand at different heights, so their caps do not run
        // together into one plate.
        const bx = (j - (s.n - 1) / 2) * 2.2 + 0.6 * (hash(i * 9 + j, 44) - 0.5);
        const h = s.tall * (j % 2 ? 0.5 : 1) * (0.8 + 0.2 * hash(i * 9 + j, 45));
        s.caps.push({ bx, h, lean: bx * 0.1 + 0.2 * (hash(i * 9 + j, 46) - 0.5), r: j % 2 || hash(i * 9 + j, 47) < 0.5 ? 1 : 2 });
      } else {
        s.caps.push({ by: j * 4 - (s.n - 1) * 2, r: 3 + Math.round(2 * hash(i * 9 + j, 48)) });
      }
    }
    s.life = 0;
    s.glow = 0;
  }
  return sites;
}

export function setup(params) {
  const P = params;
  P.kind = new Uint8Array(N);
  P.base = new Float32Array(N * 3);
  P.rot = new Float32Array(N);
  build(P);
  P.occ = new Uint8Array(N);
  P.dist = new Float32Array(N);
  P.born = new Float32Array(N);
  P.dies = new Float32Array(N);
  P.tips = [];
  P.sites = makeSites();
  // Each stem stands on whatever is under it.
  for (const s of P.sites)
    for (const c of s.caps) {
      if (s.side !== 0) continue;
      const x = Math.round(s.x + c.bx);
      let y = s.y - 8;
      while (y < s.y + 4 && (x < 0 || x >= W || P.kind[(y + 1) * W + x] === AIR)) y++;
      c.foot = y;
    }
  P.spores = [];
  P.seed = Math.floor(Math.random() * 4294967296) | 0;
  P.haze = new Float32Array(HW * HH);
  P.G = new Float32Array(N);
  P.col = new Float32Array(3);
  Object.assign(P, { T: 0, sweep: 0, owed: 0, started: false, damp: 0.06, spore: 0, hue: -1 });
}

function addTip(P, x, y, a, d) {
  if (P.tips.length < TIPS * 2) P.tips.push({ x, y, a, d, acc: Math.random(), rate: CREEP * (0.6 + 0.8 * Math.random()), len: 0, last: -1 });
}

// A new tip, most often forking off a living thread, sometimes from an origin.
function sprout(P) {
  if (Math.random() < 0.55) {
    for (let k = 0; k < 40; k++) {
      const p = Math.floor(Math.random() * N);
      if (P.occ[p] && P.dies[p] - P.T > 6) {
        addTip(P, p % W, (p / W) | 0, Math.random() * 6.283, P.dist[p]);
        return;
      }
    }
  }
  const o = ORIGINS[Math.floor(Math.random() * ORIGINS.length)];
  addTip(P, o[0] + 2 * (Math.random() - 0.5), o[1] + 2 * (Math.random() - 0.5), Math.random() * 6.283, 0);
}

// One LED of creep for a tip. Returns false when the tip stops.
function creep(P, t) {
  const { kind, occ } = P;
  let a = t.a + 0.5 * (Math.random() - 0.5);
  // In the log the threads follow the grain along it; in the stump, up and
  // down it.
  if (kind[Math.round(t.y) * W + Math.round(t.x)] === WOOD) {
    if (t.x > LOGX - 5 && t.y > LOGY - 14 && t.y < GROUND) a += 0.12 * Math.sin(-2 * a);
    else if (t.x < SX + 12) a += 0.12 * Math.sin(2 * (Math.PI / 2 - a));
  }
  for (let tries = 0; tries < 4; tries++) {
    const nx = t.x + Math.cos(a);
    const ny = t.y + Math.sin(a);
    const ix = Math.round(nx);
    const iy = Math.round(ny);
    if (ix >= 0 && ix < W && iy >= 0 && iy < H && GROWS[kind[iy * W + ix]]) {
      const p = iy * W + ix;
      t.x = nx;
      t.y = ny;
      t.a = a;
      if (p === t.last) return true;
      // Two threads that meet fuse, and the one arriving stops.
      if (occ[p] && P.dies[p] - P.T > 2 && Math.random() < 0.6) return false;
      t.last = p;
      occ[p] = 1;
      P.dist[p] = ++t.d;
      P.born[p] = P.T;
      // Threads in the soil and the litter rot sooner than those in the wood.
      P.dies[p] = P.T + (LIFE + LIFE_J * Math.random()) * (kind[p] === WOOD ? 1 : 0.6);
      if (Math.random() < (kind[p] === SOIL ? FORK * 0.5 : FORK)) addTip(P, nx, ny, a + (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.6 * Math.random()), t.d);
      return ++t.len < 70;
    }
    a += (Math.random() < 0.5 ? -1 : 1) * (0.9 + 1.2 * Math.random());
  }
  return false;
}

// Spores leave the caps of the clusters that are up.
function shed(P, count) {
  const up = P.sites.filter((s) => s.life > 0.6);
  for (let n = 0; n < count && up.length && P.spores.length < MAXS; n++) {
    const s = up[Math.floor(sporeRandom(P) * up.length)];
    const c = s.caps[Math.floor(sporeRandom(P) * s.caps.length)];
    const side = s.side === 0;
    P.spores.push({
      x: side ? s.x + c.bx + c.lean * c.h + (sporeRandom(P) - 0.5) * 2 * c.r : s.x + s.side * c.r * sporeRandom(P),
      y: side ? c.foot - c.h - 1 : s.y + c.by + 1,
      v: 1.6 + 2.6 * sporeRandom(P),
      age: 0,
      life: 9 + 9 * sporeRandom(P),
      ph: 6.28 * sporeRandom(P),
      w: 0,
    });
  }
}

function world(P, wdt, spores) {
  P.T += wdt;
  const T = P.T;
  // Threads creep.
  while (P.tips.length < TIPS) sprout(P);
  P.tips = P.tips.filter((t) => {
    for (t.acc += wdt * t.rate; t.acc >= 1; t.acc--) if (!creep(P, t)) return false;
    return true;
  });
  // Old threads rot away, a few times a second.
  P.sweep += wdt;
  if (P.sweep > 0.2) {
    P.sweep = 0;
    const { occ, dies } = P;
    for (let p = 0; p < N; p++) if (occ[p] && dies[p] < T) occ[p] = 0;
  }
  // Each cluster's life: up over the first eighth, glowing, then withering.
  for (const s of P.sites) {
    const u = ((T + s.offset) % s.period) / s.period;
    s.life = u < 0.12 ? smooth(0, 0.12, u) : u < 0.74 ? 1 : 1 - smooth(0.74, 0.88, u);
    s.glow = s.life * (0.62 + 0.38 * Math.sin((T * 6.283) / s.beat + s.phase));
  }
  // Spores rise, sway and fade.
  P.owed += wdt * (6 + 75 * spores);
  const n = Math.floor(P.owed);
  P.owed -= n;
  shed(P, n);
  P.spores = P.spores.filter((m) => {
    m.age += wdt;
    m.y -= m.v * wdt;
    m.x += wdt * (1.1 * Math.sin(T * 0.5 + m.ph) + 0.3 * Math.sin(m.y * 0.1));
    m.w = Math.min(1, m.age / 1.5) * clamp((m.life - m.age) / 3, 0, 1);
    return m.age < m.life && m.y > -2 && m.x > -2 && m.x < W + 1;
  });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  const speed = clamp(k[1], 0.1, 4) / 2;
  const spores = clamp(k[2], 0, 1);
  P.damp = clamp(k[3], 0, 1);
  P.spore = spores;
  if (P.hue !== k[0]) {
    P.hue = k[0];
    hueOf(k[0], P.col);
  }
  if (!P.started) {
    P.started = true;
    for (let t = 0; t < PRE; t += PRE_DT) world(P, PRE_DT, spores);
  }
  if (input.btnPressed && input.btnPressed[0]) shed(P, 160);
  world(P, dt * speed, spores);
}

function byte(v) {
  return v > 255 ? 255 : v < 0 ? 0 : v | 0;
}

export function draw(display, params) {
  const P = params;
  if (!P.G) return;
  const { G, kind, rot, occ, dist, born, dies, base, haze } = P;
  const T = P.T;
  const damp = P.damp;
  const gain = 0.8 + 0.7 * damp;
  // Rotten wood glows where it is wet enough, breathing slowly.
  const edge = 0.45 - 0.3 * damp;
  for (let p = 0; p < N; p++) {
    const r = rot[p];
    if (r <= edge) {
      G[p] = 0;
      continue;
    }
    const x = p % W;
    const y = (p / W) | 0;
    const breath = 0.55 + 0.45 * Math.sin(x * 0.16 - T * 0.6 + 0.8 * Math.sin(y * 0.07 + T * 0.3));
    G[p] = 0.5 * smooth(edge, edge + 0.45, r) * breath;
  }
  // The threads: dim along their length, a pulse running out along each, and
  // the growing tip bright.
  const kw = 6.283 / WAVE;
  const om = kw * RUN;
  for (let p = 0; p < N; p++) {
    if (!occ[p]) continue;
    const age = T - born[p];
    const left = dies[p] - T;
    const fade = Math.min(1, age / 0.5) * clamp(left / 4, 0, 1);
    let c = 0.5 + 0.5 * Math.cos(dist[p] * kw - T * om);
    c = c * c * c;
    const soil = kind[p] === SOIL || kind[p] === LITTER ? 0.8 : 1;
    G[p] += fade * soil * (0.2 + 0.55 * c) + (age < 1 ? 0.5 * (1 - age) : 0);
  }
  for (const t of P.tips) G[Math.round(t.y) * W + Math.round(t.x)] += 0.55;
  // The spore haze: each spore counts into the grid, which is spread back
  // over the LEDs smoothly.
  haze.fill(0);
  for (const m of P.spores) {
    const fx = m.x / 4;
    const fy = m.y / 4;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix >= HW - 1 || iy >= HH - 1) continue;
    const u = fx - ix;
    const v = fy - iy;
    const w = m.w;
    const q = iy * HW + ix;
    haze[q] += w * (1 - u) * (1 - v);
    haze[q + 1] += w * u * (1 - v);
    haze[q + HW] += w * (1 - u) * v;
    haze[q + HW + 1] += w * u * v;
  }
  const hk = 0.045 + 0.035 * P.spore;
  for (let y = 0; y < H; y++) {
    const fy = y / 4;
    const iy = Math.min(HH - 2, Math.floor(fy));
    const v = fy - iy;
    for (let x = 0; x < W; x++) {
      const fx = x / 4;
      const ix = Math.min(HW - 2, Math.floor(fx));
      const u = fx - ix;
      const q = iy * HW + ix;
      const d = (haze[q] * (1 - u) + haze[q + 1] * u) * (1 - v) + (haze[q + HW] * (1 - u) + haze[q + HW + 1] * u) * v;
      if (d > 0) G[y * W + x] += hk * Math.min(d, 5);
    }
  }
  // Each spore itself, a mote caught in the glow.
  for (const m of P.spores) {
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    if (x >= 0 && x < W && y >= 0 && y < H) G[y * W + x] += 0.3 * m.w * (0.6 + 0.4 * Math.sin(T * 3 + m.ph * 5));
  }
  // The clusters: a soft halo on the wood round them, then stems and caps.
  for (const s of P.sites) {
    if (s.life <= 0) continue;
    const g = s.glow;
    const cy = s.side === 0 ? s.y - s.tall * 0.6 : s.y;
    const cx = s.x + s.side * 2;
    for (let y = Math.max(0, Math.floor(cy - 9)); y <= Math.min(H - 1, cy + 9); y++)
      for (let x = Math.max(0, Math.floor(cx - 9)); x <= Math.min(W - 1, cx + 9); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 < 81) G[y * W + x] += 0.2 * g * (1 - d2 / 81) ** 2;
      }
    for (const c of s.caps) {
      if (s.side === 0) {
        const h = c.h * s.life;
        for (let j = 0; j <= h; j++) {
          const x = Math.round(s.x + c.bx + c.lean * j);
          const y = c.foot - j;
          if (x >= 0 && x < W && y >= 0) G[y * W + x] += 0.32 * g;
        }
        const tx = s.x + c.bx + c.lean * h;
        const ty = c.foot - Math.round(h) - 1;
        const r = c.r * (0.4 + 0.6 * s.life);
        // A Mycena cap is a little bell: one LED at the top, wider at the rim.
        for (let row = 0; row <= c.r; row++) {
          const half = row === c.r ? r + 0.4 : (r * row) / c.r;
          const y = ty - c.r + row;
          if (y < 0 || y >= H) continue;
          for (let x = Math.round(tx - half); x <= Math.round(tx + half); x++)
            if (x >= 0 && x < W) G[y * W + x] += g * (row === c.r ? 1.15 : 0.85);
        }
      } else {
        // A Panellus shelf: a thin bracket out of the wood, its top dim and
        // the gills under it bright, the rim bent down.
        const r = Math.round(c.r * (0.4 + 0.6 * s.life));
        const y0 = Math.round(s.y + c.by);
        for (let i = 0; i <= r; i++) {
          const x = Math.round(s.x + s.side * i);
          if (x < 0 || x >= W) continue;
          if (i < r - 1 && y0 > 0) G[(y0 - 1) * W + x] += 0.45 * g;
          if (y0 >= 0 && y0 < H) G[y0 * W + x] += 0.75 * g;
          if (i > 0 && i < r && y0 + 1 < H) G[(y0 + 1) * W + x] += 1.25 * g;
        }
      }
    }
  }
  // Light the floor: the dark as it was painted, plus the glow in the Glow
  // colour, running toward white where it is brightest.
  const C = P.col;
  for (let p = 0; p < N; p++) {
    const q = p * 3;
    const g = G[p] * gain;
    let r = base[q];
    let gg = base[q + 1];
    let b = base[q + 2];
    if (g > 0) {
      const v = g * 255;
      const w = g > 0.7 ? (g - 0.7) * 170 : 0;
      r += v * C[0] + w;
      gg += v * C[1] + w;
      b += v * C[2] + w;
    }
    display.setPixel(p % W, (p / W) | 0, byte(r), byte(gg), byte(b));
  }
}
