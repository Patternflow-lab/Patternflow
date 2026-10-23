// ===== Patternflow pattern =====
// Title:   Paternoster
// Family:  machine
// Idea:    A paternoster lift in an old office building, cut open from the machine room to the pit: open wooden cabins climb the right shaft and sink down the left on one endless chain, cross over the chain wheels at the top and the bottom, and office workers step in and out as the cabins pass their floor.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after the paternoster lifts of European office buildings, cabins on a chain that never stops
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Floors=3..6, Busy=0..1
//
// Knob 1: Light. The building's lamps, from warm bulbs hanging in each corridor and cabin at 0 to cold fluorescent tubes at 1, with the colour of every wall, cabin and coat under them.
// Knob 2: Speed. How fast the building runs: at 2 the chain moves 0.35 m/s, as a real paternoster does, and a cabin passes each floor every ten seconds; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Floors. Three to six floors between the machine room and the pit; more floors make the storeys, the cabins and the people smaller and put more cabins on the chain.
// Knob 4: Busy. How many people come out of the offices to ride: one every three seconds or so in the whole building at 0, a crowd of five at every opening and two in every cabin at 1. One in eight stays on and rides round over the top or under the bottom.

const W = 64;
const H = 128;
const N = W * H;
// Two shafts side by side: cabins go up on the right, down on the left. A cabin is 15 LEDs
// wide on a centre line 9 LEDs from the middle, and the chain wheels have that radius.
const XC = 32;
const R = 9;
const XL = XC - R;
const XR = XC + R;
const HALF = 7;
// The walls between the corridors and the shafts, with an opening on each floor.
const WALL_L = 14;
const WALL_R = 49;
// A storey is 3.5 m; the chain runs at V m/s at Speed 2 and people walk at WALK m/s.
const V = 0.35;
const WALK = 0.75;
// A cabin carries two people. They step in or out within WIN of a storey of the floor level.
const SEATS = 2;
const WIN = 0.12;
const STEP = 0.55;
// People waiting, riding or walking: at most this many in the building.
const MAX = 56;
// Where the people waiting at an opening stand, from the front of the line, in the left
// corridor; the right one is its mirror.
const SPOTS = [11, 6, 8, 3, 1];
const WALKIN = 0;
const RIDE = 1;
const BOARD = 2;
const ALIGHT = 3;
const WALKOUT = 4;

const COATS = [[34, 44, 90], [70, 70, 78], [112, 70, 44], [150, 36, 48], [36, 84, 60], [206, 184, 132], [236, 236, 230], [26, 26, 30], [70, 120, 170]];
const LEGS = [[44, 44, 50], [30, 36, 70], [24, 24, 28], [90, 66, 46], [150, 140, 128]];
const SKIN = [[226, 176, 140], [170, 116, 84], [120, 80, 56], [240, 196, 164]];
const HAIR = [[30, 24, 20], [96, 62, 34], [210, 180, 110], [150, 150, 150], [70, 40, 30]];
const HAT = [[60, 44, 34], [36, 36, 40], [110, 100, 84]];
// Floor numbers painted on the corridor walls, 3 by 5.
const DIGIT = ["010110010010111", "111001111100111", "111001011001111", "101101111001001", "111100111001111", "111100111101111"];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// The building for a number of floors: storey height S, cabin height CH, floor levels
// (the row people stand on is one above), and the chain's straight runs and length.
function geometry(F) {
  const S = Math.floor(107 / (F + 1.44));
  const CH = Math.round(0.72 * S);
  const top = Math.floor((126 - F * S - 2 * CH - 2 * R) / 2);
  const Lt = top + S + R + CH;
  const L = [];
  for (let i = 0; i < F; i++) L[i] = Lt + (F - 1 - i) * S;
  // A cabin's floor runs between fTop, where the whole cabin is up in the machine room,
  // and fBot, where it is down in the pit.
  const fTop = Lt - S - 2;
  const fBot = L[0] + CH;
  const Ls = fBot - fTop;
  const len = 2 * Ls + 2 * Math.PI * R;
  const pitch = Math.max(CH + Math.max(3, Math.round(0.3 * S)), 17);
  const nc = Math.round(len / pitch);
  return { F, S, CH, Lt, L, fTop, fBot, Ls, len, nc, pitch: len / nc, hp: Math.max(7, Math.round(0.54 * S)), wp: S >= 19 ? 4 : 3, door: Math.round(0.62 * S) };
}

// Where the chain puts a cabin s rows along it: centre column, floor row and which run:
// 0 up the right shaft, 1 over the top wheel, 2 down the left shaft, 3 under the bottom wheel.
function pathAt(G, s, out) {
  s = ((s % G.len) + G.len) % G.len;
  const arc = Math.PI * R;
  if (s < G.Ls) {
    out.cx = XR;
    out.f = G.fBot - s;
    out.seg = 0;
  } else if ((s -= G.Ls) < arc) {
    out.cx = XC + R * Math.cos(s / R);
    out.f = G.fTop - R * Math.sin(s / R);
    out.seg = 1;
  } else if ((s -= arc) < G.Ls) {
    out.cx = XL;
    out.f = G.fTop + s;
    out.seg = 2;
  } else {
    s -= G.Ls;
    out.cx = XC - R * Math.cos(s / R);
    out.f = G.fBot + R * Math.sin(s / R);
    out.seg = 3;
  }
}

// The lamps: warm bulbs at 0, a plain white at 0.5, fluorescent at 1.
function lampColour(k) {
  return k < 0.5 ? mix([255, 192, 120], [255, 240, 218], k * 2) : mix([255, 240, 218], [206, 232, 255], k * 2 - 1);
}

export function setup(params) {
  const P = params;
  P.bg = new Float32Array(N * 3);
  P.kind = new Uint8Array(N);
  P.buf = new Float32Array(N * 3);
  P.glow = [new Float32Array(H), new Float32Array(H)];
  P.cab = [];
  P.pos = { cx: 0, f: 0, seg: 0 };
  P.t = 0;
  P.F = -1;
  P.lightKey = -1;
}

function build(P, F) {
  P.F = F;
  P.G = geometry(F);
  P.s = 0;
  P.people = [];
  P.doors = new Float32Array(F * 2);
  P.cab = [];
  for (let c = 0; c < P.G.nc; c++) P.cab.push({ cx: 0, f: 0, seg: 0, n: 0 });
  P.lightKey = -1;
}

// Each corridor sends people to the lift: side 0 is the left corridor, which rides down,
// side 1 the right one, which rides up. Someone with nowhere to go that way, or one in
// eight of the rest, stays on over the top or under the bottom and gets out the other side.
function spawn(P, i, side) {
  const G = P.G;
  const dead = side === 1 ? i === G.F - 1 : i === 0;
  const over = dead || Math.random() < 0.12;
  let dest;
  if (!over) dest = side === 1 ? i + 1 + Math.floor(Math.random() * (G.F - 1 - i)) : Math.floor(Math.random() * i);
  else dest = Math.floor(Math.random() * G.F);
  P.doors[i * 2 + side] = P.t + 2;
  P.people.push({
    st: WALKIN,
    fl: i,
    side,
    x: side === 0 ? 3 : 60,
    feet: G.L[i] - 1,
    dest,
    exit: over ? 1 - side : side,
    cab: -1,
    slot: 0,
    t0: 0,
    x0: 0,
    y0: 0,
    coat: pick(COATS),
    legs: Math.random() < 0.25 ? null : pick(LEGS),
    skin: pick(SKIN),
    hair: pick(HAIR),
    hat: Math.random() < 0.3 ? pick(HAT) : null,
    bag: Math.random() < 0.35,
    ph: Math.random() * 6,
  });
}

function waiting(people, i, side) {
  let n = 0;
  for (const p of people) if (p.st === WALKIN && p.fl === i && p.side === side) n++;
  return n;
}

function ease(u) {
  u = clamp(u, 0, 1);
  return u * u * (3 - 2 * u);
}

function step(P, dt, busy) {
  const G = P.G;
  P.t += dt;
  P.s += (V / 3.5) * G.S * dt;
  for (let c = 0; c < G.nc; c++) {
    pathAt(G, P.s + c * G.pitch, P.pos);
    const k = P.cab[c];
    k.cx = P.pos.cx;
    k.f = P.pos.f;
    k.seg = P.pos.seg;
    k.n = 0;
  }
  const people = P.people;
  for (const p of people) if (p.cab >= 0) P.cab[p.cab].n++;
  // New people come out of the office doors.
  const rate = 0.06 + 0.9 * busy * busy;
  // A quiet building has two waiting at an opening at most; a busy one a crowd of five.
  const cap = 2 + Math.round(3 * busy);
  for (let i = 0; i < G.F; i++)
    for (let side = 0; side < 2; side++) {
      const dead = side === 1 ? i === G.F - 1 : i === 0;
      if (people.length < MAX && Math.random() < rate * dt * (dead ? 0.15 : 1) && waiting(people, i, side) < cap) spawn(P, i, side);
    }
  const walk = (WALK / 3.5) * G.S * dt;
  const win = WIN * G.S;
  const queue = {};
  for (let n = 0; n < people.length; n++) {
    const p = people[n];
    if (p.st === WALKIN) {
      // Line up at the opening behind whoever came first.
      const key = p.fl * 2 + p.side;
      const q = queue[key] || 0;
      queue[key] = q + 1;
      // Two at the front, the rest a step behind them.
      const sx = SPOTS[Math.min(q, SPOTS.length - 1)];
      const spot = p.side === 0 ? sx : W - 1 - sx;
      p.back = q >= 2 && q < 4;
      p.feet = G.L[p.fl] - (p.back ? 2 : 1);
      const d = spot - p.x;
      p.walking = Math.abs(d) > 0.3;
      p.x += clamp(d, -walk, walk);
      // The first two in line can step into the same cabin side by side.
      if (q < SEATS && !p.walking) {
        const want = p.side === 1 ? 0 : 2;
        for (let c = 0; c < G.nc; c++) {
          const k = P.cab[c];
          if (k.seg !== want || k.n >= SEATS) continue;
          // Step in while the cabin floor is coming level, not once it is past.
          const off = (k.f - G.L[p.fl]) * (want === 0 ? 1 : -1);
          if (off > win || off < -0.3 * win) continue;
          const taken = people.some((o) => o.cab === c && o.slot === 0);
          p.slot = taken ? 1 : 0;
          p.cab = c;
          p.st = BOARD;
          p.t0 = P.t;
          p.x0 = p.x;
          p.y0 = p.feet;
          k.n++;
          break;
        }
      }
    } else if (p.st === BOARD || p.st === RIDE) {
      const k = P.cab[p.cab];
      const sx = k.cx + (p.slot ? 3 : -3);
      if (p.st === BOARD) {
        const u = ease((P.t - p.t0) / STEP);
        p.x = p.x0 + (sx - p.x0) * u;
        p.feet = p.y0 + (k.f - 1 - p.y0) * u;
        p.walking = u < 1;
        if (u >= 1) p.st = RIDE;
      } else {
        p.x = sx;
        p.feet = k.f - 1;
        p.walking = false;
        const want = p.exit === 1 ? 0 : 2;
        if (k.seg === want && Math.abs(k.f - G.L[p.dest]) < 0.6 * win) {
          p.st = ALIGHT;
          p.t0 = P.t;
          p.x0 = p.x;
          p.y0 = p.feet;
          p.side = p.exit;
          p.fl = p.dest;
          p.cab = -1;
        }
      }
    } else if (p.st === ALIGHT) {
      const u = ease((P.t - p.t0) / STEP);
      const ex = p.side === 0 ? WALL_L - 2 : WALL_R + 3;
      p.x = p.x0 + (ex - p.x0) * u;
      p.feet = p.y0 + (G.L[p.fl] - 1 - p.y0) * u;
      p.walking = true;
      if (u >= 1) p.st = WALKOUT;
    } else {
      const door = p.side === 0 ? 3 : 60;
      p.x += clamp(door - p.x, -walk, walk);
      p.walking = true;
      if (Math.abs(door - p.x) < 2) P.doors[p.fl * 2 + p.side] = P.t + 1.5;
      if (Math.abs(door - p.x) < 0.3) p.gone = true;
    }
  }
  if (people.some((p) => p.gone)) P.people = people.filter((p) => !p.gone);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.light = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0.2, 3);
  const F = Math.round(clamp(k[2], 3, 6));
  const busy = clamp(k[3], 0, 1);
  if (F !== P.F) {
    // A new building: the chain has been running a while and people are about.
    build(P, F);
    P.s = Math.random() * P.G.len;
    for (let i = 0; i < 300; i++) step(P, 0.1, busy);
    // Then three more seconds at the knob's pace, so Speed shows from the start.
    for (let i = 0; i < 30; i++) step(P, 0.05 * speed, busy);
  }
  step(P, (dt * speed) / 2, busy);
}

// The building behind the cabins, lit by the lamps: machine room, storeys, slabs, shaft
// walls with an opening on each floor, the column between the shafts, the pit.
function background(P) {
  const G = P.G;
  const lc = lampColour(P.light).map((v) => v / 255);
  const tube = P.light;
  const bg = P.bg;
  const kind = P.kind;
  const roomFloor = G.Lt - G.S;
  const pitTop = G.L[0] + 2;
  for (let y = 0; y < H; y++) {
    // Which storey this row is in (0 at the bottom), or -1 in a slab, machine room or pit.
    let st = -1;
    let slab = false;
    let level = 0;
    if (y >= roomFloor && y < pitTop) {
      const k = Math.floor((G.L[0] + 1 - y) / G.S);
      const i = clamp(k, 0, G.F - 1);
      const r = G.L[0] - i * G.S - y;
      if (r <= 0 && r >= -1) slab = true;
      else if (y < roomFloor + 2) slab = true;
      else {
        st = r > 0 ? i : i - 1;
        level = G.L[st];
      }
    }
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      let c;
      let k = 0;
      const shaft = (x > WALL_L && x < 31) || (x > 33 && x < WALL_R);
      const inShafts = y >= roomFloor && y < pitTop;
      if (y < roomFloor) {
        // Machine room: dark walls, a caged bulb on the left.
        const d = Math.hypot(x - 6, y - 4);
        const l = 0.5 + 1.6 / (1 + (d * d) / 60);
        c = [30 * l, 32 * l, 40 * l];
        if (d < 1.2) c = [255, 214, 150];
        // The motor on the right, with its drive wheel.
        if (x >= 52 && x <= 61 && y >= roomFloor - 7 && y < roomFloor) c = y === roomFloor - 7 ? [80, 96, 86] : [52, 70, 62];
        const my = roomFloor - 11;
        if (Math.abs(Math.hypot(x - 56.5, y - my) - 2.8) < 0.6) c = [96, 100, 108];
        // Its belt runs to the axle of the top chain wheel.
        const wy = G.fTop - (G.CH - 2) / 2;
        if (x > XC && x < 56 && (Math.abs(y - (my - 2.8 + ((wy - 1.5 - my + 2.8) * (56.5 - x)) / (56.5 - XC))) < 0.5 || Math.abs(y - (my + 2.8 + ((wy + 1.5 - my - 2.8) * (56.5 - x)) / (56.5 - XC))) < 0.5)) c = [62, 56, 52];
      } else if (y >= pitTop) {
        // The pit: bare concrete and an iron ladder.
        const l = 0.75 - 0.3 * ((y - pitTop) / Math.max(1, H - pitTop));
        c = [44 * l, 44 * l, 50 * l];
        if ((x === 3 || x === 7) && y < H - 1) c = [70, 60, 50];
        if (x > 3 && x < 7 && (y - pitTop) % 4 === 2) c = [70, 60, 50];
      } else if (inShafts && shaft) {
        // Shaft back wall, brick, lit by the cabins going by.
        const mortar = y % 3 === 0 || (x + (Math.floor(y / 3) % 2) * 3) % 6 === 0;
        c = mortar ? [40, 36, 36] : [92, 64, 52];
        k = x < XC ? 1 : 2;
      } else if (inShafts && x >= 31 && x <= 33) {
        // The steel column between the shafts.
        c = x === 32 ? [70, 78, 96] : [44, 50, 62];
        if (x === 32 && y % 5 === 0) c = [120, 126, 140];
      } else if (slab) {
        c = y === roomFloor || (y > roomFloor && (G.L.includes(y) || y === pitTop - 2)) ? [150, 128, 104] : [96, 94, 92];
      } else if (x === WALL_L || x === WALL_R) {
        // The corridor walls by the shafts, open on each floor.
        const open = st >= 0 && y >= level - G.door;
        c = open ? [26, 22, 22] : [120, 124, 112];
      } else {
        // A corridor: cream wall, a band of green tiles, the office door and the floor's number.
        const left = x < WALL_L;
        const cx = left ? 6 : 57;
        const ty = level - G.S + 2;
        const h = level - y;
        const dx = x - cx;
        const dy = y - ty;
        const pool = 1 / (1 + (dx * dx + dy * dy) / (40 + 260 * tube));
        const l = (0.42 + 0.3 * tube) + (0.85 - 0.25 * tube) * pool;
        if (h <= Math.round(0.36 * G.S)) c = x % 3 === 0 || h % 3 === 0 ? [40, 96, 74] : [64, 142, 108];
        else c = [228, 214, 184];
        const door = left ? x >= 0 && x <= 3 : x >= 60;
        if (door && h <= G.door) c = h > G.door - Math.round(G.door * 0.4) && (left ? x >= 1 && x <= 2 : x >= 61 && x <= 62) ? [255, 228, 170] : [100, 60, 36];
        // The number, beside the opening at the top of the storey.
        const nx = left ? 9 : 52;
        const ny = ty + 2;
        if (x >= nx && x < nx + 3 && y >= ny && y < ny + 5 && DIGIT[Math.min(st, 5)][(y - ny) * 3 + x - nx] === "1") c = [40, 40, 64];
        c = [c[0] * l, c[1] * l, c[2] * l];
        // The lamp under the slab: a bulb on its cord, or a tube that grows with the Light knob.
        const bulb = tube < 0.5;
        if (y === ty + (bulb ? 1 : 0) && Math.abs(dx) <= 0.6 + 3.4 * tube) c = [255, 255, 255];
        if (bulb && y === ty && dx === 0) c = [90, 90, 90];
      }
      // The corridors are under the building's lamps; the machine room and the pit have their
      // own bulb, and the shaft walls are lit by the cabins as they pass.
      const m = k || y < roomFloor || y >= pitTop ? [1, 1, 1] : lc;
      bg[o] = c[0] * m[0];
      bg[o + 1] = c[1] * m[1];
      bg[o + 2] = c[2] * m[2];
      kind[p] = k;
    }
  }
}

function put(buf, x, y, c, m) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = c[0] * m[0];
  buf[o + 1] = c[1] * m[1];
  buf[o + 2] = c[2] * m[2];
}

// One cabin: roof, posts, varnished panelling lit from the lamp under the roof, a brass
// handrail, the floor with its brass edge.
function cabin(P, buf, k, lc) {
  const G = P.G;
  const x0 = Math.round(k.cx) - HALF;
  const f = Math.round(k.f);
  const top = f - G.CH + 2;
  const rail = top + Math.round(G.CH * 0.55);
  const tube = P.light;
  for (let y = top; y <= f + 1; y++) {
    if (y < 0 || y >= H) continue;
    const dy = y - top - 2;
    for (let i = 0; i <= 2 * HALF; i++) {
      const x = x0 + i;
      let c;
      let m = lc;
      // The lamp's light on the panelling: a pool under a bulb, even under a tube.
      const d2 = (i - HALF) * (i - HALF) + dy * dy * 1.6;
      const l = (0.42 + 0.3 * tube) + (0.85 - 0.3 * tube) / (1 + d2 / (14 + 60 * tube));
      if (y === top) c = [44, 30, 24];
      else if (y === top + 1) c = [74, 48, 32];
      else if (y === f) c = [200, 154, 72];
      else if (y === f + 1) c = [40, 32, 28];
      else if (i === 0 || i === 2 * HALF) c = [134, 86, 48];
      else if (y === top + 2 && Math.abs(i - HALF) <= 0.6 + 3.4 * tube) {
        c = [255, 255, 255];
        m = [1, 1, 1];
      } else if (i <= 2 || i >= 2 * HALF - 2) c = [96 * l, 58 * l, 34 * l];
      else if (y === rail) c = [190 * l, 146 * l, 66 * l];
      else {
        const seam = (i - 3) % 4 === 3 ? 0.72 : 1;
        c = [172 * l * seam, 98 * l * seam, 54 * l * seam];
      }
      put(buf, x, y, c, m);
    }
  }
}

function person(P, buf, p, m) {
  const G = P.G;
  const h = G.hp;
  const x = Math.round(p.x);
  const feet = Math.round(p.feet);
  const face = h >= 10 ? 2 : 1;
  const torso = Math.round((h - 2 - face) * 0.5);
  const legs = h - 2 - face - torso;
  const l0 = G.wp === 4 ? -2 : -1;
  const stride = p.walking && Math.floor(P.t * 5 + p.ph) % 2 === 0;
  let y = feet;
  // Shoes and legs, together standing and apart in mid stride; a skirt over stockings.
  for (let r = 0; r <= legs; r++, y--) {
    const skirt = !p.legs && r >= legs - 1 && r > 0;
    const c = r === 0 ? [28, 24, 22] : skirt ? p.coat : p.legs || p.skin;
    if (skirt) for (let i = l0; i <= 1; i++) put(buf, x + i, y, c, m);
    else if (stride && r < legs) {
      put(buf, x + l0, y, c, m);
      put(buf, x + 1, y, c, m);
    } else {
      put(buf, x - 1, y, c, m);
      put(buf, x, y, c, m);
    }
  }
  for (let r = 0; r < torso; r++, y--) for (let i = l0; i <= 1; i++) put(buf, x + i, y, p.coat, m);
  if (p.bag) {
    const bx = p.side === 0 ? x + 2 : x + l0 - 1;
    put(buf, bx, feet - legs + 1, [120, 72, 36], m);
    put(buf, bx, feet - legs + 2, [120, 72, 36], m);
  }
  for (let r = 0; r < face; r++, y--) {
    put(buf, x - 1, y, p.skin, m);
    put(buf, x, y, p.skin, m);
  }
  const top = p.hat || p.hair;
  put(buf, x - 1, y, top, m);
  put(buf, x, y, top, m);
  if (p.hat) {
    put(buf, x - 2, y + 1, p.hat, m);
    put(buf, x + 1, y + 1, p.hat, m);
  }
}

export function draw(display, params) {
  const P = params;
  const G = P.G;
  if (P.lightKey !== P.light) {
    P.lightKey = P.light;
    background(P);
  }
  const lc = lampColour(P.light).map((v) => v / 255);
  const buf = P.buf;
  buf.set(P.bg);
  // Cabin light spills on to the shaft walls above and below each cabin.
  for (let side = 0; side < 2; side++) {
    const g = P.glow[side];
    g.fill(0.32);
    for (const k of P.cab) {
      if (k.seg !== (side ? 0 : 2)) continue;
      const f = Math.round(k.f);
      const top = f - G.CH + 2;
      for (let d = 1; d <= 8; d++) {
        const v = 0.32 + 0.75 * Math.exp(-d / 2.5);
        if (top - d >= 0) g[top - d] = Math.max(g[top - d], v);
        if (f + 1 + d < H) g[f + 1 + d] = Math.max(g[f + 1 + d], 0.32 + 0.4 * Math.exp(-d / 2));
      }
    }
  }
  for (let p = 0; p < N; p++) {
    const k = P.kind[p];
    if (!k) continue;
    const g = P.glow[k - 1][Math.floor(p / W)];
    const o = p * 3;
    buf[o] *= g * lc[0];
    buf[o + 1] *= g * lc[1];
    buf[o + 2] *= g * lc[2];
  }
  // The chain along the cabins' middle line, links moving with it, and the two wheels.
  const mid = (G.CH - 2) / 2;
  const pos = P.pos;
  for (let s = 0; s < G.len; s += 0.7) {
    pathAt(G, s, pos);
    const link = Math.floor((s - P.s) / 2) & 1;
    const x = Math.round(pos.cx);
    const y = Math.round(pos.f - mid);
    put(buf, x, y, link ? [150, 150, 160] : [70, 70, 80], [1, 1, 1]);
  }
  for (const [wy, dir] of [[G.fTop - mid, 1], [G.fBot - mid, -1]]) {
    const a0 = (dir * P.s) / R;
    for (let sp = 0; sp < 6; sp++) {
      const a = a0 + (sp * Math.PI) / 3;
      for (let r = 1; r < R - 1; r += 0.7) put(buf, Math.round(XC + r * Math.cos(a)), Math.round(wy - r * Math.sin(a)), [96, 100, 112], [1, 1, 1]);
    }
    for (let a = 0; a < 6.3; a += 0.12) put(buf, Math.round(XC + (R - 1) * Math.cos(a)), Math.round(wy + (R - 1) * Math.sin(a)), [120, 124, 136], [1, 1, 1]);
    put(buf, XC, Math.round(wy), [190, 190, 200], [1, 1, 1]);
  }
  // An office door stands open while someone comes out or goes in, and the office shows.
  for (let i = 0; i < G.F; i++)
    for (let side = 0; side < 2; side++) {
      if (P.doors[i * 2 + side] <= P.t) continue;
      const L = G.L[i];
      // Office light spills out across the corridor floor and wall beside the door.
      for (let y = L - G.door; y < L; y++)
        for (let j = 5; j < 13; j++) {
          const o = (y * W + (side === 0 ? j : W - 1 - j)) * 3;
          const g = 1 + 0.9 * Math.exp(-(j - 5) / 4) * (0.4 + 0.6 * (y - L + G.door) / G.door);
          buf[o] *= g;
          buf[o + 1] *= g;
          buf[o + 2] *= g;
        }
      for (let y = L - G.door; y < L; y++)
        for (let j = 0; j < 5; j++) {
          const x = side === 0 ? j : W - 1 - j;
          const c = j === 4 ? [92, 56, 34] : y === L - 1 ? [120, 96, 70] : (y - L) % 4 === 0 && j < 3 ? [150, 120, 80] : [250, 236, 200];
          put(buf, x, y, c, j === 4 ? lc : [0.95, 0.92, 0.85]);
        }
    }
  for (const k of P.cab) cabin(P, buf, k, lc);
  // People: in the corridors under the corridor lamps, in the cabins under the cabin lamp.
  // The second row of a crowd first, a little further from the lamp.
  for (const back of [true, false])
    for (const p of P.people) {
      if (!p.back !== !back) continue;
      const l = p.st === RIDE || p.st === BOARD ? 1 : back ? 0.74 : 0.92;
      person(P, buf, p, [lc[0] * l, lc[1] * l, lc[2] * l]);
    }
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, Math.floor(p / W), clamp(buf[o], 0, 255), clamp(buf[o + 1], 0, 255), clamp(buf[o + 2], 0, 255));
  }
}
