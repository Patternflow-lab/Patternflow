// ===== Patternflow pattern =====
// Title:   Sprout
// Family:  growth
// Idea:    Each stem climbs one LED at a time and only into room nobody else has taken, so a garden draws itself in single pixels, flowers, drops its petals and goes back into the ground.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Grow=0.25..6, Branches=3..14, Wind=-1..1
//
// Knob 1: Hue. The flower colour; each plant takes a shade either side of it.
// Knob 2: Grow. How fast the tips climb, and with it how soon a plant flowers, withers and makes room.
// Knob 3: Branches. How many tips a plant may have, from a stem with two side shoots to a small tree.
// Knob 4: Wind. Leans new growth and sways the tops; left of centre it blows the other way.
// Buttons: K1 tap sows a seed now.

const W = 64;
const H = 128;
const PLANTS = 18;
// A plant can stand most of the way up the tall panel, so it needs room for more LEDs.
const PIX = 720;
const TIPS = 96;
// Petals in the air and on the ground. Fallen ones lie in drifts up to PILE
// LEDs deep at the foot of the garden.
const FALL = 320;
const PILE = 5;

const STEM = 1;
const LEAF = 2;
const BUD = 3;
const PETAL = 4;
const HEART = 5;

// Five kinds of plant: a daisy on a tall stem, a tulip on a straight one, a
// branchy aster with many small heads, a lupine whose top grows florets, and
// a hollyhock that stands near the top of the panel with cups up its spike.
const DAISY = 0;
const TULIP = 1;
const ASTER = 2;
const LUPINE = 3;
const HOLLYHOCK = 4;
// How much a stem wanders off its line.
const KIND_WOBBLE = [0.1, 0.04, 0.2, 0.06, 0.03];
const KIND_LEN = [74, 44, 40, 78, 94];
const KIND_SPREAD = [42, 30, 34, 36, 22];
const KIND_FORK = [0.12, 0.05, 0.3, 0.07, 0.02];
const KIND_LEAF = [0.12, 0.3, 0.22, 0.16, 0.3];
// The top of a hollyhock stem, in LEDs, that carries flowers.
const SPIKE = 44;

// Flowers as offsets from the tip, a big one for the main stem and a small
// one for side shoots. The big daisy is seven LEDs across, its heart a plus
// (HEART_PLUS).
const BIG = [
  [0, -3, -2, -2, -1, -2, 0, -2, 1, -2, 2, -2, -2, -1, -1, -1, 1, -1, 2, -1, -3, 0, -2, 0, 2, 0, 3, 0, -2, 1, -1, 1, 1, 1, 2, 1, -2, 2, -1, 2, 0, 2, 1, 2, 2, 2, 0, 3],
  [0, -1, -1, -1, 1, -1, -1, -2, 0, -2, 1, -2, -1, -3, 1, -3],
  [0, -1, -1, -1, 1, -1, -1, 0, 1, 0, -1, 1, 1, 1, 0, -2, 0, -3, -2, -2, 2, -2, -2, 0, -3, 0, 2, 0, 3, 0, -2, 2, 2, 2],
  [-1, 0, 1, 0, 0, -1],
  [-1, 0, 1, 0, 0, -1],
];
const SMALL = [
  [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 1, 1],
  [0, -1, -1, -1, 1, -1, -1, -2, 1, -2],
  [-1, 0, 1, 0, 0, -1],
  [-1, 0, 1, 0, 0, -1],
  [-1, 0, 1, 0, 0, -1],
];
const HEART_PLUS = [-1, 0, 1, 0, 0, -1, 0, 1];
// A hollyhock cup, around a heart two LEDs out from the stem, for a cup on
// the right; one on the left mirrors it. The open cups low on the spike are
// wide, the young ones near its top are small.
const CUP = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1, 0, -2, 0, 2, 2, 0];
const YOUNG_CUP = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];
// budGen at or past this marks a hollyhock cup: +1 for the right side, +2 for
// a wide one. A stem's generation stays below Branches, so it never gets here.
const CUP_GEN = 100;

const GROWING = 1;
const HOLDING = 2;
const WITHERING = 3;
const RECEDING = 4;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function free(p, x, y) {
  return x >= 0 && x < W && y >= 0 && y < H && p.kind[y * W + x] === 0;
}

// A tip may step into a pixel only when its two sides and the row ahead are
// empty, so two branches never touch.
function room(p, x, y) {
  if (x < 1 || x > W - 2 || y < 3) return false;
  if (!free(p, x, y) || !free(p, x - 1, y) || !free(p, x + 1, y)) return false;
  return free(p, x - 1, y - 1) && free(p, x, y - 1) && free(p, x + 1, y - 1);
}

// Every LED a plant takes goes on its list, in the order it grew.
function put(p, plant, x, y, kind) {
  const n = p.count[plant];
  if (n >= PIX) return;
  const i = y * W + x;
  p.kind[i] = kind;
  p.owner[i] = plant;
  p.pix[plant * PIX + n] = i;
  p.count[plant] = n + 1;
  p.lit++;
}

function newTip(p, plant, x, y, len, dir, gen) {
  for (let t = 0; t < TIPS; t++) {
    if (p.tipPlant[t] >= 0) continue;
    p.tipPlant[t] = plant;
    p.tipX[t] = x;
    p.tipY[t] = y;
    p.tipLeft[t] = len;
    p.tipFx[t] = x;
    p.tipLean[t] = dir;
    p.tipGen[t] = gen;
    p.tipSince[t] = 0;
    p.tipAcc[t] = Math.random();
    p.tipPace[t] = 0.8 + Math.random() * 0.4;
    p.tips[plant]++;
    p.tipsEver[plant]++;
    return t;
  }
  return -1;
}

function sow(p) {
  let slot = -1;
  for (let i = 0; i < PLANTS; i++) if (!p.state[i]) slot = i;
  if (slot < 0) return false;
  for (let tries = 0; tries < 8; tries++) {
    const x = 3 + Math.floor(Math.random() * (W - 6));
    // A plant that is withering or going back into the ground already makes
    // room: a seed may come up beside it, where its leaves are not in the way.
    let near = false;
    for (let i = 0; i < PLANTS; i++) if ((p.state[i] === GROWING || p.state[i] === HOLDING) && Math.abs(p.baseX[i] - x) < 6) near = true;
    let clear = !near;
    for (let y = H - 1; clear && y > H - 12; y--) clear = room(p, x, y);
    if (!clear) continue;
    // Two hollyhocks stand in the garden whenever there is room for them; the
    // rest is a mix.
    let tall = 0;
    for (let i = 0; i < PLANTS; i++) if ((p.state[i] === GROWING || p.state[i] === HOLDING) && p.style[i] === HOLLYHOCK) tall++;
    const r = Math.random();
    const kind = tall < 2 ? HOLLYHOCK : r < 0.32 ? DAISY : r < 0.54 ? TULIP : r < 0.76 ? ASTER : LUPINE;
    p.state[slot] = GROWING;
    p.baseX[slot] = x;
    p.count[slot] = 0;
    p.tips[slot] = 0;
    p.tipsEver[slot] = 0;
    p.buds[slot] = 0;
    p.wither[slot] = 0;
    p.stopped[slot] = 0;
    p.shade[slot] = (Math.random() - 0.5) * 0.18;
    p.green[slot] = 0.27 + Math.random() * 0.1;
    p.style[slot] = kind;
    put(p, slot, x, H - 1, STEM);
    newTip(p, slot, x, H - 1, KIND_LEN[kind] + Math.floor(Math.random() * KIND_SPREAD[kind]), 0, 0);
    return true;
  }
  return false;
}

function bloom(p, plant, x, y, gen) {
  const style = p.style[plant];
  if (gen >= CUP_GEN) {
    // The bud beside the stem opens into a cup whose heart sits one LED further out.
    const side = (gen - CUP_GEN) & 1 ? 1 : -1;
    const shape = (gen - CUP_GEN) & 2 ? CUP : YOUNG_CUP;
    const cx = x + side;
    p.kind[y * W + x] = PETAL;
    p.buds[plant]--;
    if (free(p, cx, y)) put(p, plant, cx, y, HEART);
    for (let n = 0; n < shape.length; n += 2) {
      const px = cx + shape[n] * side;
      const py = y + shape[n + 1];
      if (free(p, px, py)) put(p, plant, px, py, PETAL);
    }
    return;
  }
  // A tulip has no heart showing.
  p.kind[y * W + x] = style === TULIP ? PETAL : HEART;
  p.buds[plant]--;
  const shape = gen === 0 || Math.random() < 0.3 ? BIG[style] : SMALL[style];
  if (style === DAISY && shape === BIG[DAISY]) {
    for (let n = 0; n < HEART_PLUS.length; n += 2) if (free(p, x + HEART_PLUS[n], y + HEART_PLUS[n + 1])) put(p, plant, x + HEART_PLUS[n], y + HEART_PLUS[n + 1], HEART);
  }
  for (let n = 0; n < shape.length; n += 2) {
    const px = x + shape[n];
    const py = y + shape[n + 1];
    if (free(p, px, py)) put(p, plant, px, py, PETAL);
  }
}

function endTip(p, t) {
  const plant = p.tipPlant[t];
  const i = p.tipY[t] * W + p.tipX[t];
  // A stem that grew a few LEDs ends in a bud; a stub just stops.
  if (p.tipSince[t] >= 2 || p.tipGen[t] === 0) {
    p.kind[i] = BUD;
    p.budAt[i] = p.budTime * (0.6 + Math.random() * 0.8);
    p.budGen[i] = p.tipGen[t];
    p.buds[plant]++;
  }
  if (p.tipGen[t] === 0) p.stopped[plant] = 1;
  p.tipPlant[t] = -1;
  p.tips[plant]--;
}

function stepTip(p, t, wind) {
  const plant = p.tipPlant[t];
  const style = p.style[plant];
  const x = p.tipX[t];
  const y = p.tipY[t];
  if (p.tipLeft[t] <= 0 || p.count[plant] > PIX - 24) {
    endTip(p, t);
    return;
  }
  // The stem keeps a heading, LEDs across per LED up. It eases back towards
  // upright, or towards the wind, so a side shoot leaves at a slant and
  // curves up like a candelabra arm.
  let lean = p.tipLean[t];
  lean += (wind * 0.45 - lean) * 0.14 + (Math.random() - 0.5) * KIND_WOBBLE[style];
  lean = Math.max(-1, Math.min(1, lean));
  let fx = p.tipFx[t] + lean;
  let nx = Math.round(fx);
  const ny = y - 1;
  if (nx < x - 1) nx = x - 1;
  if (nx > x + 1) nx = x + 1;
  if (fx > nx + 0.5) fx = nx + 0.5;
  if (fx < nx - 0.5) fx = nx - 0.5;
  if (!room(p, nx, ny)) {
    // Blocked: a slanted tip tries straight up, and a straight one tries the
    // slant it leans to, then the other. Right after a fork the side shoot
    // has taken a cell beside the stem, and the stem steps away from it.
    const toward = lean < 0 ? x - 1 : x + 1;
    const away = lean < 0 ? x + 1 : x - 1;
    const other = nx !== x ? x : room(p, toward, ny) ? toward : away;
    if (room(p, other, ny)) {
      nx = other;
      fx = nx;
      lean *= 0.3;
    } else {
      endTip(p, t);
      return;
    }
  }
  put(p, plant, nx, ny, STEM);
  p.tipX[t] = nx;
  p.tipY[t] = ny;
  p.tipFx[t] = fx;
  p.tipLean[t] = lean;
  p.tipLeft[t]--;
  p.tipSince[t]++;

  if (style === LUPINE && p.tipGen[t] === 0 && p.tipLeft[t] < 22) {
    // The top of a lupine climbs with a floret either side.
    for (let side = -1; side <= 1; side += 2) {
      if (free(p, nx + side, ny + 1) && free(p, nx + side * 2, ny + 1)) put(p, plant, nx + side, ny + 1, PETAL);
    }
  } else if (style === HOLLYHOCK && (p.tipGen[t] === 0 || p.stopped[plant]) && p.tipLeft[t] < SPIKE && ny < H - 40) {
    // Up the spike a bud every third LED, one side then the other. They open
    // from the bottom up, as the stem passes them. When the stem is stopped,
    // often by its own side shoot right after a fork, a side shoot carries
    // the spike instead.
    const left = p.tipLeft[t];
    const side = ((left / 3) | 0) & 1 ? 1 : -1;
    const bx = nx + side;
    if (left % 3 === 0 && left > 2 && free(p, bx, ny + 1) && free(p, bx + side, ny + 1)) {
      put(p, plant, bx, ny + 1, BUD);
      const c = (ny + 1) * W + bx;
      p.budAt[c] = p.budTime * (0.8 + Math.random() * 0.5);
      p.budGen[c] = CUP_GEN + (side > 0 ? 1 : 0) + (left > 14 ? 2 : 0);
      p.buds[plant]++;
    }
  } else if (
    p.tipSince[t] > 1 &&
    // A tulip keeps its leaves low, and a hollyhock its big ones.
    Math.random() < KIND_LEAF[style] * (style === TULIP && ny < H - 18 ? 0.2 : style === HOLLYHOCK && ny < H - 48 ? 0.15 : 1)
  ) {
    // Now and then a leaf beside the stem, rising away from it.
    const side = Math.random() < 0.5 ? -1 : 1;
    const lx = nx + side;
    if (free(p, lx, ny + 1) && free(p, lx + side, ny + 1) && free(p, lx, ny) && free(p, lx, ny + 2)) {
      // An aster carries small florets where another plant has leaves.
      if (style === ASTER && Math.random() < 0.6) put(p, plant, lx, ny + 1, PETAL);
      else {
        put(p, plant, lx, ny + 1, LEAF);
        if (Math.random() < 0.6 && free(p, lx + side, ny) && free(p, lx + side * 2, ny)) put(p, plant, lx + side, ny, LEAF);
      }
    }
  }

  // A fork: the side shoot heads out one way and the stem leans the other.
  if (
    p.tipsEver[plant] < p.branches &&
    p.tipSince[t] > 3 &&
    p.tipLeft[t] > 6 &&
    Math.random() < KIND_FORK[style] * (0.6 + p.branches * 0.12)
  ) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const len = Math.floor(p.tipLeft[t] * (0.45 + Math.random() * 0.35));
    if (newTip(p, plant, nx, ny, len, side * (0.75 + Math.random() * 0.25), p.tipGen[t] + 1) >= 0) {
      p.tipLean[t] -= side * 0.35;
      p.tipSince[t] = 0;
    }
  }
}

function release(p, x, y, hue) {
  for (let f = 0; f < FALL; f++) {
    if (p.fState[f]) continue;
    p.fState[f] = 1;
    p.fx[f] = x + 0.5;
    p.fy[f] = y + 0.5;
    p.fHue[f] = hue;
    p.fRest[f] = 0;
    p.fSway[f] = Math.random() * 6.28;
    return;
  }
}

// A petal that lands rolls off a drift onto a lower neighbour, downwind
// first, so the drifts slope like sand. On a full drift it blows away.
function settle(p, f, wind, slow) {
  const down = wind < 0 ? -1 : 1;
  let x = Math.floor(p.fx[f]);
  for (let roll = 0; roll < W; roll++) {
    const a = x + down;
    const b = x - down;
    if (a >= 0 && a < W && p.pile[a] + 1 < p.pile[x]) x = a;
    else if (b >= 0 && b < W && p.pile[b] + 1 < p.pile[x]) x = b;
    else break;
  }
  if (p.pile[x] >= PILE) {
    p.fState[f] = 0;
    return;
  }
  p.fx[f] = x + 0.5;
  p.fy[f] = H - 0.5 - p.pile[x];
  p.pile[x]++;
  p.fState[f] = 2;
  p.fRest[f] = (12 + Math.random() * 14) * slow;
}

// A fallen petal goes into the soil, and the ones lying on it settle a LED.
function sink(p, f) {
  const x = Math.floor(p.fx[f]);
  const y = p.fy[f];
  p.fState[f] = 0;
  p.pile[x]--;
  for (let g = 0; g < FALL; g++) if (p.fState[g] === 2 && Math.floor(p.fx[g]) === x && p.fy[g] < y) p.fy[g] += 1;
}

function step(p, dt, k) {
  const pace = k[1];
  const wind = k[3];
  p.branches = Math.round(k[2]);
  p.clock += dt;
  // Tips climb faster than on the wide panel: a stem here goes twice as high in the same season.
  const rate = 2.6 * pace;
  // Everything after growing runs on the same clock as the growing.
  const slow = 2 / pace;
  p.budTime = 1.2 * slow;

  for (let t = 0; t < TIPS; t++) {
    if (p.tipPlant[t] < 0) continue;
    p.tipAcc[t] += dt * rate * p.tipPace[t];
    while (p.tipAcc[t] >= 1 && p.tipPlant[t] >= 0) {
      p.tipAcc[t] -= 1;
      stepTip(p, t, wind);
    }
  }

  for (let i = 0; i < PLANTS; i++) {
    const s = p.state[i];
    if (!s) continue;
    const base = i * PIX;
    if (s === GROWING || s === HOLDING) {
      // Buds open in their own time.
      if (p.buds[i] > 0) {
        for (let n = 0; n < p.count[i]; n++) {
          const c = p.pix[base + n];
          if (p.kind[c] !== BUD || p.owner[c] !== i) continue;
          p.budAt[c] -= dt;
          if (p.budAt[c] <= 0) bloom(p, i, c % W, (c - (c % W)) / W, p.budGen[c]);
        }
      }
      if (s === GROWING && p.tips[i] === 0 && p.buds[i] <= 0) {
        p.state[i] = HOLDING;
        p.timer[i] = (12 + Math.random() * 12) * slow;
      }
      if (s === HOLDING) {
        p.timer[i] -= dt;
        if (p.timer[i] <= 0) {
          p.state[i] = WITHERING;
          p.timer[i] = 0;
        }
      }
    } else if (s === WITHERING) {
      p.timer[i] += dt / (1.8 * slow);
      p.wither[i] = Math.min(1, p.timer[i]);
      // Petals let go one by one and fall.
      for (let n = 0; n < p.count[i]; n++) {
        const c = p.pix[base + n];
        if (p.owner[c] !== i || (p.kind[c] !== PETAL && p.kind[c] !== HEART)) continue;
        if (Math.random() < (dt * 2) / slow) {
          if (p.kind[c] === PETAL) {
            // It falls from where the wind has it, not from where it grew.
            const py = (c - (c % W)) / W;
            release(p, (c % W) + p.offset[py], py, p.hue + p.shade[i]);
          }
          p.kind[c] = p.kind[c] === PETAL ? 0 : STEM;
          if (!p.kind[c]) p.lit--;
        }
      }
      if (p.timer[i] >= 1) {
        p.state[i] = RECEDING;
        p.timer[i] = 0;
      }
    } else if (s === RECEDING) {
      // The plant goes back the way it grew, newest LED first.
      p.timer[i] += dt * rate * 8;
      while (p.timer[i] >= 1 && p.count[i] > 0) {
        p.timer[i] -= 1;
        const n = --p.count[i];
        const c = p.pix[base + n];
        if (p.owner[c] === i && p.kind[c]) {
          p.kind[c] = 0;
          p.lit--;
        }
      }
      if (p.count[i] === 0) p.state[i] = 0;
    }
  }

  for (let f = 0; f < FALL; f++) {
    if (!p.fState[f]) continue;
    if (p.fState[f] === 1) {
      p.fSway[f] += dt * 2.2;
      p.fy[f] += dt * (3 + 1.5 * Math.sin(p.fSway[f] * 0.7));
      p.fx[f] += dt * (wind * 5 + Math.sin(p.fSway[f]) * 2.5);
      if (p.fx[f] < 0 || p.fx[f] >= W) {
        p.fState[f] = 0;
        continue;
      }
      if (p.fy[f] >= H - 0.5 - p.pile[Math.floor(p.fx[f])]) settle(p, f, wind, slow);
    } else {
      p.fRest[f] -= dt;
      if (p.fRest[f] <= 0) sink(p, f);
    }
  }

  // Sow when the garden is thin, and hold off when it is crowded.
  let alive = 0;
  for (let i = 0; i < PLANTS; i++) if (p.state[i] === GROWING || p.state[i] === HOLDING) alive++;
  p.sowTimer -= dt;
  if (p.sowTimer <= 0 && alive < 15 && p.lit < W * H * 0.24) {
    if (sow(p)) p.sowTimer = (0.6 + Math.random() * 2.2) * slow;
    else p.sowTimer = 0.5;
  }
}

export function setup(params) {
  const p = params;
  p.kind = new Uint8Array(W * H);
  p.owner = new Uint8Array(W * H);
  p.budAt = new Float32Array(W * H);
  p.budGen = new Uint8Array(W * H);
  p.pix = new Int16Array(PLANTS * PIX);
  p.count = new Int16Array(PLANTS);
  p.state = new Uint8Array(PLANTS);
  p.baseX = new Int16Array(PLANTS);
  p.tips = new Int16Array(PLANTS);
  p.tipsEver = new Int16Array(PLANTS);
  p.buds = new Int16Array(PLANTS);
  p.timer = new Float32Array(PLANTS);
  p.wither = new Float32Array(PLANTS);
  p.stopped = new Uint8Array(PLANTS);
  p.shade = new Float32Array(PLANTS);
  p.green = new Float32Array(PLANTS);
  p.style = new Uint8Array(PLANTS);
  p.tipPlant = new Int8Array(TIPS).fill(-1);
  p.tipX = new Int16Array(TIPS);
  p.tipY = new Int16Array(TIPS);
  p.tipLeft = new Int16Array(TIPS);
  p.tipFx = new Float32Array(TIPS);
  p.tipLean = new Float32Array(TIPS);
  p.tipGen = new Uint8Array(TIPS);
  p.tipSince = new Int16Array(TIPS);
  p.tipAcc = new Float32Array(TIPS);
  p.tipPace = new Float32Array(TIPS);
  p.fx = new Float32Array(FALL);
  p.fy = new Float32Array(FALL);
  p.fHue = new Float32Array(FALL);
  p.fState = new Uint8Array(FALL);
  p.fRest = new Float32Array(FALL);
  p.fSway = new Float32Array(FALL);
  p.pile = new Uint8Array(W);
  p.offset = new Int8Array(H);
  p.col = new Float32Array(3);
  p.lit = 0;
  p.clock = 0;
  p.sowTimer = 0;
  p.budTime = 1;
  p.branches = 2;
  p.hue = 0;
  p.ready = false;
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  p.hue = k[0];
  p.wind = k[3];
  if (!p.ready) {
    // Grow a garden before the first frame, so it opens mid-season at any
    // pace: a slow garden is grown in longer steps.
    p.ready = true;
    const tick = (1 / 15) * Math.min(4, 2 / k[1]);
    for (let i = 0; i < 1600; i++) step(p, tick, k);
  }
  if (input.btnPressed && input.btnPressed[0]) sow(p);
  step(p, dt, k);

  // The tops sway more than the roots; at no wind nothing moves.
  const w = p.wind;
  const gust = 0.75 + 0.25 * Math.sin(p.clock * 0.9) + 0.15 * Math.sin(p.clock * 2.3);
  for (let y = 0; y < H; y++) {
    const up = (H - 1 - y) / (H - 1);
    p.offset[y] = Math.round(w * up * up * 5 * gust);
  }
}

export function draw(display, params, time) {
  const p = params;
  const col = p.col;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);

  for (let y = 0; y < H; y++) {
    const o = p.offset[y];
    for (let x = 0; x < W; x++) {
      const c = y * W + x;
      const kind = p.kind[c];
      if (!kind) continue;
      const sx = x + o;
      if (sx < 0 || sx >= W) continue;
      const plant = p.owner[c];
      const dry = p.wither[plant];
      if (kind === STEM) {
        hsv(p.green[plant] - dry * 0.2, 0.82, 0.6 - dry * 0.12, col, 0);
      } else if (kind === LEAF) {
        hsv(p.green[plant] - 0.04 - dry * 0.17, 0.72 + dry * 0.1, 0.92 - dry * 0.35, col, 0);
      } else if (kind === BUD) {
        hsv(p.hue + p.shade[plant], 0.4, 1, col, 0);
      } else if (kind === PETAL) {
        hsv(p.hue + p.shade[plant], 0.82, 1 - dry * 0.3, col, 0);
      } else {
        // A warm heart, unless the petals are warm already.
        const hh = p.hue + p.shade[plant];
        const d = Math.abs(hh - Math.round(hh - 0.14) - 0.14);
        hsv(d < 0.09 ? 0.0 : 0.135, 0.8, 1 - dry * 0.4, col, 0);
      }
      display.setPixel(sx, y, col[0], col[1], col[2]);
    }
  }

  // Growing tips are drawn pale, the newest LED of each stem.
  for (let t = 0; t < TIPS; t++) {
    if (p.tipPlant[t] < 0) continue;
    const y = p.tipY[t];
    hsv(0.2, 0.4, 1, col, 0);
    display.setPixel(p.tipX[t] + p.offset[y], y, col[0], col[1], col[2]);
  }

  for (let f = 0; f < FALL; f++) {
    if (!p.fState[f]) continue;
    // A fallen petal is paler than one in the air. Darker, an orange one read as brown.
    hsv(p.fHue[f], p.fState[f] === 1 ? 0.82 : 0.66, 0.85, col, 0);
    display.setPixel(Math.floor(p.fx[f]), Math.floor(p.fy[f]), col[0], col[1], col[2]);
  }
}
