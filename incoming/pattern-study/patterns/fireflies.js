// ===== Patternflow pattern =====
// Title:   Fireflies
// Family:  insect
// Idea:    Synchronous fireflies over a meadow under the trees flash out of step at first, then pull each other into bursts of flashes in unison with dark pauses between, because each one's clock jumps ahead when it sees a neighbour flash.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Mirollo and Strogatz's pulse-coupled oscillators (1990), after the synchronous firefly Photinus carolinus at Elkmont in the Great Smoky Mountains
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Moon=0..1, Pace=0.5..4, Fireflies=200..480, Coupling=0..0.25
//
// Knob 1: Moon. At 0 a moonless night; turned up, a moon climbs out of the far trees into a gap in the leaves, the sky and the grass go silver, and fewer fireflies fly, down to one in four at full moon.
// Knob 2: Pace. At 2 the flashes in a burst come half a second apart, as Photinus carolinus flashes, and a burst comes round every 5.5 s; at 0.5 the flashes are two seconds apart, at 4 a quarter second, and the fireflies fly faster with it.
// Knob 3: Fireflies. How many are out, from 200 to 480; half of them are farther than 5.5 m and show as sparks along the forest edge.
// Knob 4: Coupling. How far a clock jumps for each flash it sees: at 0 every firefly keeps its own time and the meadow twinkles for ever; at 0.06 the flashes fall into step within a few seconds and the first dark pauses open; at 0.25 the swarm locks in its first burst.
// Buttons: K1 tap sweeps a bare flashlight across the meadow from left to right; every firefly in the beam goes dark and loses its place in both its clocks, and the sync has to form again.

const W = 64;
const H = 128;
const N = W * H;
const MAXF = 480;
// The camera: eye 1.5 m above the meadow, the horizon on row 74, 56 LEDs to one unit of tan.
const EYE = 1.5;
const HOR = 74;
const FOC = 56;
const NEAR = 1.4;
const FAR = 22;
// What stands in the way, by distance: tall grass at our feet, a tulip poplar 6 m off whose
// crown hangs over the top of the panel, a thinner trunk at 10 m and the far forest edge.
const GRASS_D = 2.2;
const TREE_D = 6;
const TREE2_D = 10;
const EDGE_D = 30;
const SKY_D = 1e6;

// Two clocks in each firefly. The flash clock beats every half second; the burst clock comes
// round every 5.5 s and opens a burst of four to six flashes on the next beats. Photinus
// carolinus flashes five to eight times and then waits six to nine seconds; the panel keeps
// the half second and shortens the wait, so a burst comes round inside a few seconds.
const GAP = 0.5;
const CYCLE = 5.5;
// Mirollo and Strogatz's state curve x = ln(1 + (e^b - 1) phase) / b. It is concave, so a seen
// flash moves a clock that is far from firing a little and one about to fire a lot, and the
// ones pushed over the top fire together with the flash that pushed them.
const BEND = 3;
const EB = Math.exp(BEND) - 1;
// For the first quarter of a beat after its own flash a firefly does not respond, and for the
// first 55% of its burst cycle its burst clock does not either. Without the first, a crowd
// flashing over two frames shoves every clock round again and the beat runs away.
const REST = 0.25;
const OPEN = 0.55;
// How hard the coupling knob pulls each clock, for the share of neighbours seen flashing.
// The burst clock only hears first flashes, the flash that ends somebody's dark.
const KF = 3;
const KB = 16;

// Who sees whom: the panel in 8 x 8 LED cells, and a flash seen from a cell d cells away
// counts e^(-d / 2.2), so a firefly sees about 20 LEDs round it well and nothing more than 40
// rows away.
const CS = 8;
const GX = W / CS;
const GY = H / CS;
const SIGHT = 2.2;
// Seconds the swarm runs before the first frame.
const PRE = 3;

// The flash: up in 30 ms, held for 150 ms while it sags a little, then out in a fast fade,
// gone a third of a second after it began. A firefly's lantern blinks rather than swells.
const RISE = 0.03;
const HOLD = 0.18;
const FADE = 0.05;
const LIGHT_END = 0.32;

// Glows by distance: nearer than 2.6 m, 5 m, 10 m, and beyond. Each is a lantern, one LED
// and a little cross round it, in a halo whose sigma (in LEDs) grows as it comes closer; the
// farthest are the lantern alone.
const HALO_SIG = [1, 1.2, 1.8, 2.6];
const HALO = [0, 0.45, 0.5, 0.55];
const CORE = [0.75, 0.5, 0.5, 0.5];
const CROSS = [0.19, 0.12, 0.15, 0.2];
const REACH = [1, 3, 5, 7];

// The females wait low in the grass and answer a burst with one dimmer flash in the dark after it.
const FEM = 14;
const REPLY = 0.6;

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

function fwd(phase) {
  return Math.log(1 + EB * phase) / BEND;
}

function inv(x) {
  return (Math.exp(BEND * x) - 1) / EB;
}

function envelope(age) {
  if (age < RISE) return age / RISE;
  if (age < HOLD) return 1 - (0.15 * (age - RISE)) / (HOLD - RISE);
  return 0.85 * Math.exp(-(age - HOLD) / FADE);
}

function q4(v) {
  const q = Math.round(v / 4) * 4;
  return q > 255 ? 255 : q;
}

function sizeOf(d) {
  return d < 2.6 ? 3 : d < 5 ? 2 : d < 10 ? 1 : 0;
}

// Sprites: dx, dy and weight for each glow size.
function makeSprites() {
  const out = [];
  for (let c = 0; c < 4; c++) {
    const s = [];
    const r = REACH[c];
    const k = 1 / (2 * HALO_SIG[c] * HALO_SIG[c]);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const ring = Math.abs(dx) + Math.abs(dy);
        const w = HALO[c] * Math.exp(-(dx * dx + dy * dy) * k) + (ring === 0 ? CORE[c] : ring === 1 ? CROSS[c] : 0);
        if (w > 0.02) s.push(dx, dy, w);
      }
    out.push(s);
  }
  return out;
}

// Smooth value noise on a line and on the plane, 0..1.
function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

function noise2(x, y, seed) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const u = smooth(0, 1, x - i);
  const v = smooth(0, 1, y - j);
  const a = hash(i + 131 * j, seed);
  const b = hash(i + 1 + 131 * j, seed);
  const c = hash(i + 131 * (j + 1), seed);
  const d = hash(i + 1 + 131 * (j + 1), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// What each LED shows before any firefly: the scene drawn once as a map of parts.
const SKY = 0;
const MEADOW = 1;
const EDGE = 2;
const TRUNK2 = 3;
const TRUNK = 4;
const TRUNK_LIT = 5;
const CROWN = 6;
const BLADE = 7;
const TIP = 8;
const DEPTH = [SKY_D, SKY_D, EDGE_D, TREE2_D, TREE_D, TREE_D, TREE_D, GRASS_D, GRASS_D];
// How much of the flashlight each part sends back: the haze of the sky, the far trees, bark.
const SURF = [0.15, 0.5, 0.3, 0.7, 0.9, 0.9, 0.5, 1, 1];

function drawScene(P) {
  const mask = P.mask;
  // The far forest edge 30 m off: a row of crowns, most of them the round heads of tulip
  // poplar and one in three the drooping point of a hemlock.
  const top = new Float32Array(W).fill(HOR - 6);
  for (let k = -1; k < 13; k++) {
    const cx = k * 5.5 + 4 * hash(k + 9, 12);
    const w = 3 + 4 * hash(k + 9, 13);
    const h = 5 + 11 * hash(k + 9, 14);
    const hemlock = hash(k + 9, 15) < 0.33;
    for (let x = 0; x < W; x++) {
      const u = Math.abs(x - cx) / w;
      if (u >= 1) continue;
      const lift = hemlock ? h * 1.2 * (1 - u) ** 1.3 : h * Math.sqrt(1 - u * u);
      top[x] = Math.min(top[x], HOR - 6 - lift);
    }
  }
  const footA = HOR + (FOC * EYE) / TREE_D;
  const footB = HOR + (FOC * EYE) / TREE2_D;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let m = y < HOR ? SKY : MEADOW;
      if (y <= HOR && y >= top[x] + noise1(x * 0.7, 16) * 1.5) m = EDGE;
      if (x >= 50 && x <= 52 && y <= footB) m = TRUNK2;
      // The near trunk, 7 LEDs wide at the foot and 5 under the crown; a moon catches its right side.
      const taper = 1 - y / footA;
      if (x >= 3 + taper && x <= 9 - taper && y <= footA) m = x >= 8 - taper ? TRUNK_LIT : TRUNK;
      // A limb leaves the trunk at row 50 and climbs into the leaves.
      const t = clamp((x - 8) / 17, 0, 1);
      const ly = 50 - 22 * t;
      if (x >= 8 && x <= 25 && Math.abs(y - ly - 2 * t * (1 - t)) < 1.1 - 0.4 * t) m = TRUNK;
      // The crown's lower edge hangs in lobes, high on the right where a window of sky opens for
      // the moon; inside it the leaves part here and there.
      const edge = 31 + 10 * (noise1(x / 7, 31) - 0.5) + 5 * (noise1(x / 2.7, 32) - 0.5) - 19 * smooth(27, 42, x) * (1 - smooth(57, 66, x));
      if (y < edge && !(y > 3 && y < edge - 3 && noise2(x / 4.5, y / 3.5, 33) > 0.76)) m = CROWN;
      mask[y * W + x] = m;
    }
  // Tall grass at our feet: blades leaning and bending, and seed heads on a few.
  for (let k = 0; k < 52; k++) {
    const x0 = hash(k, 51) * W;
    const tall = 9 + 20 * hash(k, 52) ** 1.5;
    const lean = (hash(k, 53) - 0.5) * 0.5;
    const bend = (hash(k, 54) - 0.5) * 0.02;
    const head = hash(k, 55) < 0.3;
    for (let j = 0; j < tall; j++) {
      const x = Math.round(x0 + lean * j + bend * j * j);
      const y = 127 - j;
      if (x < 0 || x >= W) continue;
      const tip = j > tall - 3;
      mask[y * W + x] = tip ? TIP : BLADE;
      if (head && tip && x + 1 < W) mask[y * W + x + 1] = TIP;
    }
  }
}

function bake(P, moon) {
  const { bg, occ, surf, mask } = P;
  const m = moon;
  // The moon climbs from behind the far trees into the window in the leaves.
  const mx = 46;
  const my = HOR - 8 - 44 * smooth(0, 1, m);
  const lv = smooth(0, 0.3, m);
  for (let y = 0; y < H; y++) {
    const up = y / HOR;
    const far = 1 - (y - HOR) / (H - HOR);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const part = mask[p];
      let r;
      let g;
      let b;
      if (part === SKY) {
        // Deep blue overhead, paler down at the trees.
        const lift = 0.55 + 0.45 * up;
        r = 4 + 6 * up + 24 * m * lift;
        g = 8 + 10 * up + 34 * m * lift;
        b = 22 + 20 * up + 48 * m * lift;
        if (m > 0) {
          const dd = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
          const disc = 1 - smooth(2.4, 3.4, dd);
          const glow = Math.exp(-dd / 8) * 0.5;
          r += lv * (disc * 210 + glow * 40);
          g += lv * (disc * 208 + glow * 46);
          b += lv * (disc * 186 + glow * 54);
        }
      } else if (part === MEADOW) {
        // A faint sheen of sky on the far grass, darker at our feet.
        r = 2 + 3 * far + 16 * m * (0.5 + 0.5 * far);
        g = 4 + 4 * far + 24 * m * (0.5 + 0.5 * far);
        b = 4 + 5 * far + 22 * m * (0.5 + 0.5 * far);
      } else if (part === EDGE) {
        r = 2 + 6 * m;
        g = 4 + 10 * m;
        b = 8 + 13 * m;
      } else if (part === TRUNK2) {
        r = 2 + 9 * m;
        g = 3 + 10 * m;
        b = 5 + 12 * m;
      } else if (part === TRUNK || part === TRUNK_LIT) {
        const lit = part === TRUNK_LIT ? 1 : 0.35;
        r = 1 + 14 * m * lit;
        g = 2 + 15 * m * lit;
        b = 3 + 16 * m * lit;
      } else if (part === CROWN) {
        r = 1 + 6 * m;
        g = 2 + 9 * m;
        b = 4 + 10 * m;
      } else {
        // Grass: under a moon the tips catch the light.
        const tip = part === TIP ? 1 : 0.5;
        r = 1 + 12 * m * tip;
        g = 2 + 18 * m * tip;
        b = 2 + 14 * m * tip;
      }
      bg[p * 3] = r;
      bg[p * 3 + 1] = g;
      bg[p * 3 + 2] = b;
      occ[p] = DEPTH[part];
      surf[p] = part === MEADOW ? 0.35 + 0.65 * (1 - far) : SURF[part];
    }
  }
  // Stars between the leaves and the far trees, fainter as the moon comes up.
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(hash(i * 7 + 3, 21) * W);
    const y = Math.floor(2 + hash(i * 5 + 1, 22) * 62);
    const p = y * W + x;
    if (mask[p] !== SKY) continue;
    const v = (34 + 56 * hash(i, 23)) * (1 - 0.65 * m);
    bg[p * 3] += v * 0.85;
    bg[p * 3 + 1] += v * 0.9;
    bg[p * 3 + 2] += v;
  }
  P.baked = moon;
}

function burstLength() {
  return 4 + Math.floor(Math.random() * 3);
}

function spawn(P, i) {
  // Distance log-uniform from 1.4 to 22 m: as many between 2 and 4 m as between 10 and 20.
  const d = NEAR * Math.pow(FAR / NEAR, Math.random());
  P.d[i] = d;
  P.X[i] = (Math.random() - 0.5) * (W / FOC) * d * 1.2;
  // Three in ten keep low over the grass, most fly a metre to three metres up, and one in
  // seven is up in the leaves.
  const u = Math.random();
  P.h[i] = u < 0.3 ? 0.15 + Math.random() * 0.65 : u < 0.86 ? 0.8 + Math.random() * 2.4 : 3.2 + Math.random() * 4.5;
  const a = Math.random() * Math.PI * 2;
  P.vx[i] = Math.cos(a) * 0.3;
  P.vh[i] = (Math.random() - 0.5) * 0.1;
  P.vd[i] = Math.sin(a) * 0.3;
  // Each clock runs a little fast or slow: the beat within 3%, the burst within 5%.
  P.tr[i] = (1 + (Math.random() - 0.5) * 0.06) / GAP;
  P.pr[i] = (1 + (Math.random() - 0.5) * 0.1) / CYCLE;
  P.th[i] = Math.random();
  P.ps[i] = Math.random();
  P.nf[i] = burstLength();
  P.left[i] = Math.max(0, P.nf[i] - Math.floor((P.ps[i] * CYCLE) / GAP));
  P.age[i] = 9;
  P.hold[i] = 0;
  P.shy[i] = Math.random();
}

export function setup(params) {
  const P = params;
  for (const key of ["X", "h", "d", "vx", "vh", "vd", "tr", "pr", "th", "ps", "age", "hold", "shy"]) P[key] = new Float32Array(MAXF);
  P.nf = new Uint8Array(MAXF);
  P.left = new Uint8Array(MAXF);
  P.last = new Uint8Array(MAXF);
  P.sx = new Int16Array(MAXF);
  P.sy = new Int16Array(MAXF);
  P.cell = new Int16Array(MAXF);
  // Flashes and first flashes that began last frame, and fireflies flying, per cell; and the
  // same three as each cell sees them through the sight kernel.
  const G = GX * GY;
  for (const key of ["pa", "pf", "pc", "na", "nf2", "nc", "sa", "sf", "sc"]) P[key] = new Float32Array(G);
  P.kern = new Float32Array(G);
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) P.kern[y * GX + x] = Math.exp(-Math.sqrt(x * x + y * y) / SIGHT);
  P.bg = new Float32Array(N * 3);
  P.mask = new Uint8Array(N);
  drawScene(P);
  P.occ = new Float32Array(N);
  P.surf = new Float32Array(N);
  P.lum = new Float32Array(N);
  P.ang = new Float32Array(N);
  P.sprites = makeSprites();
  // The flashlight is held at our chest, below the bottom of the panel.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) P.ang[y * W + x] = Math.atan2(x - 32, 170 - y);
  for (let i = 0; i < MAXF; i++) spawn(P, i);
  // The females sit still, low in the grass, 1.6 to 4 m away.
  P.fx = new Int16Array(FEM);
  P.fy = new Int16Array(FEM);
  P.fd = new Float32Array(FEM);
  P.fmem = new Float32Array(FEM);
  P.fwait = new Float32Array(FEM);
  P.fage = new Float32Array(FEM).fill(9);
  for (let j = 0; j < FEM; j++) {
    const d = 1.6 + 2.4 * hash(j, 41);
    P.fd[j] = d;
    P.fx[j] = Math.round(4 + 56 * hash(j, 42));
    P.fy[j] = Math.round(HOR + (FOC * (EYE - 0.15 - 0.3 * hash(j, 43))) / d);
  }
  Object.assign(P, { count: 200, moon: 0, baked: -1, torch: -1, beam: 0, beamOn: 0, started: false });
}

function flash(P, i, first) {
  P.age[i] = 0;
  P.na[P.cell[i]] += 1;
  if (first) P.nf2[P.cell[i]] += 1;
  P.last[i] = first ? 3 : 1;
}

// Spread the last frame's flashes and the crowd through the sight kernel, from each cell
// that holds any to every cell within five rows of cells.
function look(P) {
  const { pa, pf, pc, sa, sf, sc, kern } = P;
  sa.fill(0);
  sf.fill(0);
  sc.fill(0);
  for (let s = 0; s < GX * GY; s++) {
    const a = pa[s];
    const f = pf[s];
    const c = pc[s];
    if (a === 0 && c === 0) continue;
    const sx = s % GX;
    const sy = (s / GX) | 0;
    for (let ty = Math.max(0, sy - 5); ty <= Math.min(GY - 1, sy + 5); ty++) {
      const row = Math.abs(ty - sy) * GX;
      for (let tx = 0; tx < GX; tx++) {
        const k = kern[row + Math.abs(tx - sx)];
        const t = ty * GX + tx;
        sa[t] += a * k;
        sf[t] += f * k;
        sc[t] += c * k;
      }
    }
  }
}

function advance(P, step, pace, count, eps, moon) {
  // Last frame's flashes become what is seen this frame.
  for (const [a, b] of [
    ["pa", "na"],
    ["pf", "nf2"],
    ["pc", "nc"],
  ]) {
    const t = P[a];
    P[a] = P[b];
    P[b] = t;
    P[b].fill(0);
  }
  look(P);
  const { sa, sf, sc } = P;
  // Fewer fly under a bright moon.
  const shyLine = 0.75 * moon;

  for (let i = 0; i < count; i++) {
    const out = P.shy[i] < shyLine;
    if (P.age[i] < 9) P.age[i] += step;
    const c = P.cell[i];
    let seeA = 0;
    let seeF = 0;
    if (!out && P.hold[i] <= 0) {
      // What counts is the share of the neighbours seen flashing, so a thick swarm does not
      // shove every clock round at once. A firefly does not see its own flash.
      const crowd = Math.max(3, sc[c] - 1);
      seeA = (sa[c] - (P.last[i] & 1)) / crowd;
      seeF = (sf[c] - (P.last[i] >> 1)) / crowd;
    }
    P.last[i] = 0;
    if (P.hold[i] > 0) P.hold[i] -= step;

    let p = P.ps[i] + step * P.pr[i];
    if (p > OPEN && seeF > 0 && eps > 0) {
      const q = (p - OPEN) / (1 - OPEN);
      const x = fwd(Math.min(1, q)) + eps * KB * seeF;
      p = x >= 1 ? 1 : OPEN + (1 - OPEN) * inv(x);
    }
    if (p >= 1) {
      p = 0;
      P.nf[i] = burstLength();
      P.left[i] = P.nf[i];
    }
    P.ps[i] = p;

    let t = P.th[i] + step * P.tr[i];
    if (t > REST && seeA > 0 && eps > 0) {
      const u = (t - REST) / (1 - REST);
      const x = fwd(Math.min(1, u)) + eps * KF * seeA;
      t = x >= 1 ? 1 : REST + (1 - REST) * inv(x);
    }
    if (t >= 1) {
      t = 0;
      if (P.left[i] > 0) {
        const first = P.left[i] === P.nf[i];
        P.left[i]--;
        if (!out && P.hold[i] <= 0) flash(P, i, first);
      }
    }
    P.th[i] = t;

    // Flight: a slow wander, about a third of a metre a second, turning gently.
    const fly = step * (0.6 + 0.4 * Math.min(2, pace / 2));
    P.vx[i] += (Math.random() - 0.5) * 0.4 * fly;
    P.vd[i] += (Math.random() - 0.5) * 0.4 * fly;
    P.vh[i] += (Math.random() - 0.5) * 0.2 * fly - P.vh[i] * 0.5 * fly;
    const sp = Math.sqrt(P.vx[i] * P.vx[i] + P.vd[i] * P.vd[i]);
    if (sp > 0.45) {
      P.vx[i] *= 0.45 / sp;
      P.vd[i] *= 0.45 / sp;
    }
    let d = P.d[i] + P.vd[i] * fly;
    if (d < NEAR || d > FAR) {
      P.vd[i] = -P.vd[i];
      d = clamp(d, NEAR, FAR);
    }
    P.d[i] = d;
    let X = P.X[i] + P.vx[i] * fly;
    const half = (0.6 * W * d) / FOC;
    if (X > half) X -= 2 * half;
    else if (X < -half) X += 2 * half;
    P.X[i] = X;
    let h = P.h[i] + P.vh[i] * fly;
    if (h < 0.2 || h > 8) {
      P.vh[i] = -P.vh[i];
      h = clamp(h, 0.2, 8);
    }
    P.h[i] = h;
    const sx = Math.round(W / 2 + (FOC * X) / d);
    const sy = Math.round(HOR + (FOC * (EYE - h)) / d);
    P.sx[i] = sx;
    P.sy[i] = sy;
    P.cell[i] = clamp(sy >> 3, 0, GY - 1) * GX + clamp(sx >> 3, 0, GX - 1);
    if (!out) P.nc[P.cell[i]] += 1;

    // The flashlight: a firefly in the beam goes dark and loses its place in both clocks. At
    // Elkmont the park asks for red cellophane over the lens and the beam kept on the ground.
    // This one is bare.
    if (P.beamOn > 0.3 && sx >= 0 && sx < W && sy >= 0 && sy < H) {
      const a = P.ang[sy * W + sx];
      if (Math.abs(a - P.beam) < 0.14) {
        P.th[i] = Math.random();
        P.ps[i] = Math.random() * OPEN;
        P.left[i] = 0;
        P.hold[i] = 0.8;
        if (P.age[i] < LIGHT_END) P.age[i] = LIGHT_END;
      }
    }
  }

  // The females: each listens to the flashes round her and, once they stop, answers.
  for (let j = 0; j < FEM; j++) {
    if (P.fage[j] < 9) P.fage[j] += step;
    const c = clamp(P.fy[j] >> 3, 0, GY - 1) * GX + clamp(P.fx[j] >> 3, 0, GX - 1);
    const heard = sa[c] / Math.max(3, sc[c]);
    if (heard > 0.04) {
      P.fmem[j] = Math.min(1, P.fmem[j] + heard);
      P.fwait[j] = REPLY * (0.8 + 0.4 * hash(j, 44));
    } else if (P.fmem[j] > 0.25) {
      P.fwait[j] -= step;
      if (P.fwait[j] <= 0) {
        P.fage[j] = 0;
        P.fmem[j] = 0;
      }
    } else P.fmem[j] = Math.max(0, P.fmem[j] - step * 0.2);
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 200, 0.06];
  dt = Math.min(dt, 0.1);
  const moon = clamp(k[0], 0, 1);
  const pace = Math.max(0.1, k[1]);
  const step = (dt * pace) / 2;
  const count = clamp(Math.round(k[2]), 0, MAXF);
  const eps = Math.max(0, k[3]);
  P.count = count;
  P.moon = moon;
  if (Math.abs(P.baked - moon) > 0.004) bake(P, moon);

  if (input.btnPressed && input.btnPressed[0]) P.torch = 0;
  if (P.torch >= 0) {
    P.torch += dt;
    const u = P.torch / 2.4;
    P.beam = -0.9 + 1.8 * smooth(0, 1, u);
    P.beamOn = smooth(0, 0.06, u) * (1 - smooth(0.92, 1, u));
    if (u >= 1) {
      P.torch = -1;
      P.beamOn = 0;
    }
  }

  if (!P.started) {
    // The night is under way when the panel opens: the swarm has had three seconds to start
    // finding its beat.
    P.started = true;
    for (let i = 0; i < PRE * 30; i++) advance(P, (pace / 2) / 30, pace, count, eps, moon);
  }
  advance(P, step, pace, count, eps, moon);
}

function splat(P, sx, sy, d, e) {
  const lum = P.lum;
  const occ = P.occ;
  const spr = P.sprites[sizeOf(d)];
  for (let j = 0; j < spr.length; j += 3) {
    const x = sx + spr[j];
    const y = sy + spr[j + 1];
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const p = y * W + x;
    if (occ[p] < d) continue;
    lum[p] += e * spr[j + 2];
  }
}

export function draw(display, params) {
  const P = params;
  P.lum.fill(0);
  const shyLine = 0.75 * P.moon;
  for (let i = 0; i < P.count; i++) {
    const age = P.age[i];
    if (age >= LIGHT_END || P.shy[i] < shyLine) continue;
    splat(P, P.sx[i], P.sy[i], P.d[i], envelope(age));
  }
  // A female's answer is dimmer and slower to fade.
  for (let j = 0; j < FEM; j++) {
    const age = P.fage[j] * 0.6;
    if (age >= LIGHT_END) continue;
    splat(P, P.fx[j], P.fy[j], P.fd[j], envelope(age) * 0.5);
  }
  const { bg, surf, lum, ang } = P;
  const beamOn = P.beamOn;
  const beam = P.beam;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = bg[p * 3];
      let g = bg[p * 3 + 1];
      let b = bg[p * 3 + 2];
      const v = lum[p];
      if (v > 0.004) {
        // 560 nm is a yellow green; past full the core runs pale.
        const t = v < 1 ? v : 1;
        const hot = v > 0.8 ? Math.min(1, (v - 0.8) / 0.7) : 0;
        r += 182 * t + 50 * hot;
        g += 255 * t;
        b += 12 * t + 110 * hot;
      }
      if (beamOn > 0) {
        const da = ang[p] - beam;
        const I = beamOn * Math.exp(-(da * da) / 0.016) * surf[p] * (0.5 + (0.5 * y) / H);
        r += 150 * I;
        g += 138 * I;
        b += 112 * I;
      }
      // Every channel in steps of 4: on the panel 64 steps look the same as 256, and the dark
      // gradients stop being noise.
      display.setPixel(x, y, q4(r), q4(g), q4(b));
    }
}
