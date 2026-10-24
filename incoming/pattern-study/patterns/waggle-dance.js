// ===== Patternflow pattern =====
// Title:   Waggle Dance
// Family:  insect
// Idea:    Bees crawl over one comb of an observation hive while foragers home from the flowers dance figures of eight, each waggle run as far from straight up as the flowers lie from the sun, with a ring of followers turned to face her.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after Karl von Frisch's reading of the honeybee's waggle dance
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Bees=80..240, Sun=-1..1
//
// Knob 1: Light. Daylight at 0, the window's sun lying across the glass in four panes; the curtain closes on the sun, a warm lamp takes over by 0.5, and towards 1 it turns to a red lamp the bees cannot see.
// Knob 2: Speed. At 2 a waggle run takes about a second and a bee walks about a body length a second; 0.2 is ten times slower.
// Knob 3: Bees. Eighty to 240; turned up, more walk in from the sides until they hide the comb.
// Knob 4: Sun. The sun's bearing against the clover field: at 0.06 the runs point nearly straight up, and turning it swings every dance and slides the window's sun across the glass.
// Buttons: K1 tap brings a forager home from a rich patch; she runs up from the entrance and dances long and hard, with more followers round her.

const [W, H] = [64, 128];
const N = W * H;
// Cells six LEDs across the flats, rows five apart (a hexagon squashed by
// four in a hundred, so every cell is drawn alike); the frame's top bar,
// its bottom bar and the entrance slot in it.
const [CW, RH, TOP, BOT, NC, NR, ENX] = [6, 5, 5, 123, 13, 27, 9];
const Y0 = TOP + 2.5;
const [EMPTY, HONEY, NECTAR, POLLEN, BROOD, LARVA, EGG] = [0, 1, 2, 3, 4, 5, 6];
const [CRAWL, REST, DIP, FOLLOW, DANCE, HOME, EXIT] = [0, 1, 2, 3, 4, 5, 6];
// Pollen: orange, yellow, ochre, rust, purple-grey, buff, olive, red-orange.
const POLLENS = [[0.95, 0.52, 0.08], [0.95, 0.8, 0.16], [0.74, 0.54, 0.17], [0.6, 0.25, 0.1],
  [0.44, 0.37, 0.5], [0.86, 0.68, 0.36], [0.55, 0.58, 0.24], [0.9, 0.4, 0.12]];
// Bees: a dark race, the usual, a golden one. Thorax, then the amber bands.
const THX = [[0.5, 0.37, 0.2], [0.78, 0.56, 0.24], [0.9, 0.68, 0.3]];
const AMB = [[0.62, 0.44, 0.18], [1, 0.72, 0.2], [1, 0.84, 0.32]];
const [DARK, HEAD, WING] = [[0.3, 0.18, 0.08], [0.14, 0.1, 0.06], [0.8, 0.84, 0.9]];
const [SUNC, DAYC, WARM, REDC] = [[1, 0.84, 0.56], [1, 0.94, 0.82], [1, 0.66, 0.34], [1, 0.09, 0.035]];
// Where the flowers lie, against the main field, and how often foragers come from each.
const FIELDS = [0, 0, 0.95, -1.9];

const { min, max, sin, cos, abs, sqrt, floor, round, exp, atan2, PI } = Math;
const len = (a, b) => sqrt(a * a + b * b);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = clamp((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const wrap = (a) => a - 2 * PI * round(a / (2 * PI));
const rnd = () => Math.random();
function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Distance from a cell's centre in its own hexagon, 3 on the wall.
const hexd = (dx, dy) => max(abs(dx), abs(0.5 * dx + 0.9 * dy), abs(0.5 * dx - 0.9 * dy));
const cellX = (r, c) => CW * (c - 1) + (r & 1 ? 3.5 : 0.5);
const cellY = (r) => Y0 + (r - 1) * RH;
const cap = (t) => t === BROOD || t === HONEY;

// Which cell each LED sits in, and where in it.
function grid(S) {
  for (let y = TOP; y < BOT; y++)
    for (let x = 0; x < W; x++) {
      const r0 = round((y + 0.5 - Y0) / RH) + 1;
      let [best, next] = [99, 99];
      const p = y * W + x;
      for (let r = max(0, r0 - 1); r <= min(NR - 1, r0 + 1); r++) {
        const off = r & 1 ? 3.5 : 0.5;
        const c0 = round((x + 0.5 - off) / CW) + 1;
        for (let c = max(0, c0 - 1); c <= min(NC - 1, c0 + 1); c++) {
          const dx = x + 0.5 - cellX(r, c);
          const dy = y + 0.5 - cellY(r);
          const d = hexd(dx, dy);
          if (d < best) {
            next = best;
            S.cid2[p] = S.cid[p];
            best = d;
            S.cid[p] = r * NC + c;
            [S.hd[p], S.dx[p], S.dy[p]] = [d, dx, dy];
          } else if (d < next) {
            next = d;
            S.cid2[p] = r * NC + c;
          }
        }
      }
    }
}

// Honey over the top and down the corners, a band of pollen, brood below.
function layout(S) {
  for (let r = 0; r < NR; r++)
    for (let c = 0; c < NC; c++) {
      const i = r * NC + c;
      const [x, y] = [cellX(r, c), cellY(r)];
      const e = len((x - 32) / 33, (y - 70) / 28) + 0.05 * (sin(x * 0.21 + y * 0.13) + sin(y * 0.29 - x * 0.17 + 2));
      const u = rnd();
      let t;
      if (y < 24 || (e > 1.28 && y < 64)) t = u < 0.82 ? HONEY : u < 0.95 ? NECTAR : EMPTY;
      else if (e > 1 && y < 72) t = u < 0.62 ? POLLEN : u < 0.78 ? NECTAR : EMPTY;
      else if (e < 0.72) t = u < 0.68 ? BROOD : u < 0.78 ? LARVA : u < 0.81 ? EGG : EMPTY;
      else if (e < 1) t = u < 0.34 ? LARVA : u < 0.48 ? EGG : u < 0.64 ? BROOD : u < 0.68 ? POLLEN : EMPTY;
      else t = u < 0.12 ? POLLEN : u < 0.27 ? NECTAR : EMPTY;
      [S.type[i], S.age[i], S.tint[i], S.gap[i], S.pol[i]] = [t, rnd(), rnd(), rnd() * 6.283, floor(rnd() * 8)];
    }
}

// Each LED's colour as it would be in white light, and how much of the
// sun reaches it: cell bottoms stay in shadow.
function paint(S) {
  const { base, expo } = S;
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p / W) | 0;
    const q = p * 3;
    let r, g, b;
    let ex = 1;
    let dim = 0.66;
    if (y < TOP || y >= BOT) {
      // Pine, the grain running along the bar, a groove where it meets the comb.
      const gr = 0.8 + 0.2 * sin(x * 0.23 + 2 * sin(x * 0.07 + y * 1.3));
      const edge = y === TOP - 1 || y === BOT ? 0.55 : 1;
      const k = gr * edge * (0.9 + 0.1 * hash(p, 5));
      [r, g, b] = [0.6 * k, 0.42 * k, 0.24 * k];
      if (y > BOT + 1 && y < H - 1 && abs(x + 0.5 - ENX) < 5) [r, g, b] = [0.02, 0.015, 0.01];
    } else {
      const [i, d, dx, dy] = [S.cid[p], S.hd[p], S.dx[p], S.dy[p]];
      const [t, tn, rr, lit] = [S.type[i], S.tint[i], len(dx, dy), -(dx + dy) / 3];
      if (t === HONEY) {
        dim = 1;
        const k = (1 - 0.12 * (d / 2.6) ** 2 + 0.06 * lit) * (0.95 + 0.06 * hash(p, 1));
        [r, g, b] = [(1 - 0.04 * tn) * k, (0.88 - 0.16 * tn) * k, (0.6 - 0.26 * tn) * k];
      } else if (t === NECTAR) {
        // Nectar: dark amber down in the cell, a bright meniscus round it, and a glint.
        const f = (0.08 + 0.92 * sm(1.5, 2.4, d)) * (0.75 + 0.3 * tn);
        [r, g, b] = [0.07 + 0.62 * f, 0.03 + 0.36 * f, 0.006 + 0.06 * f];
        if (abs(dx + 1) < 0.6 && abs(dy + 1) < 0.7) [r, g, b] = [0.95, 0.9, 0.74];
        ex = 0.6;
      } else if (t === POLLEN) {
        const c = POLLENS[S.pol[i]];
        dim = 0.8;
        // Packed down in the cell, its inside wall in shadow round it.
        const k = (0.8 + 0.25 * tn) * (1 - 0.85 * sm(1.5, 2.3, d));
        [r, g, b] = c.map((v, n) => v * k * (0.82 + 0.3 * hash(p, 2 + n)));
        ex = 0.8;
      } else if (t === BROOD) {
        const k = (1 - 0.32 * (rr / 2.7) ** 2 + 0.1 * lit) * (hash(p, 6) < 0.14 ? 0.78 : 1) * (0.9 + 0.15 * tn);
        [r, g, b] = [0.8 * k, 0.68 * k, 0.5 * k];
      } else {
        // An open cell: dark at the bottom, its lower inside wall catching the light.
        const lip = sm(1.6, 2.4, d) * (dy > 0.5 ? 1 : 0.3);
        const k = (0.04 + 0.1 * lip) * (0.75 + 0.5 * tn);
        [r, g, b] = [k, k * 0.68, k * 0.38];
        ex = 0.2 + 0.8 * lip;
        if (t === LARVA) {
          // The larva curled in a C on its bed of jelly, bigger as it grows.
          const a = S.age[i];
          const [R, th] = [0.4 + 1.1 * a, 0.45 + 0.55 * a];
          const ang = wrap(atan2(dy, dx) - S.gap[i]);
          let on = a < 0.3 ? sm(1.2, 0.5, rr) : sm(th + 0.3, th - 0.3, abs(rr - R)) * sm(0.5, 1, abs(ang));
          if (rr < 1.9) [r, g, b] = [r + 0.18, g + 0.17, b + 0.14];
          const sh = 0.82 + 0.18 * clamp(lit + 0.5, 0, 1) + 0.05 * sin(ang * 5);
          r += (0.97 * sh - r) * on;
          g += (0.94 * sh - g) * on;
          b += (0.85 * sh - b) * on;
          ex += (0.9 - ex) * on;
        } else if (t === EGG && rr < 0.7) [r, g, b] = [0.86, 0.85, 0.78];
      }
      // The walls: pale wax round the honey, the rims of open cells lit,
      // and a dark seam where two brood caps meet.
      const w = sm(2.4, 2.6, d);
      if (w > 0) {
        const t2 = S.type[S.cid2[p]];
        const pale = t === HONEY || t === NECTAR ? 1 : 0;
        const seam = (t === BROOD || t2 === BROOD) && cap(t) && cap(t2) ? 0.15 : 1;
        // Light from above rakes the slanted walls; the upright ones stand side on to it.
        const k = (0.85 + 0.3 * hash(p, 8)) * seam * (!pale && abs(dx) > 2.6 ? 0.45 : 1);
        r += ((0.34 + 0.18 * pale) * k - r) * w;
        g += ((0.24 + 0.15 * pale) * k - g) * w;
        b += ((0.11 + 0.08 * pale) * k - b) * w;
        ex += ((seam < 1 ? 0.15 : 1) - ex) * w;
      }
    }
    // The comb sits back in the hive's shade; the bees on it catch the light.
    base[q] = r * dim;
    base[q + 1] = g * dim;
    base[q + 2] = b * dim;
    expo[p] = ex;
  }
}

// The window throws its four panes of sun on the glass; they slide and lean with the sun.
function sunPatch(S, s) {
  const [cx, cy, sh] = [32 + 22 * s, 74 - 6 * abs(s), -0.5 * s];
  for (let p = 0; p < N; p++) {
    const v = ((p / W) | 0) + 0.5 - cy;
    const u = (p % W) + 0.5 - cx - sh * v;
    let m = sm(22, 16, abs(u)) * sm(40, 33, abs(v));
    m *= 1 - 0.85 * sm(1.9, 0.7, abs(u));
    m *= 1 - 0.85 * sm(1.9, 0.7, abs(v + 5));
    S.sun[p] = m;
  }
  S.sunK = s;
}

function newBee(S, x, y, h) {
  const u = rnd();
  const b = { x, y, h, m: CRAWL, t: rnd() * 3, v: 2.6 + 2.6 * rnd(), s: 1.12 + 0.14 * rnd(), tone: u < 0.18 ? 0 : u < 0.82 ? 1 : 2, ph: rnd() * 6.28, w: 0, wag: 0, wp: 0 };
  S.bees.push(b);
  return b;
}

// A bee to the dance floor on the lower comb, clear of the other dances.
function spot(S) {
  let best = [32, 104];
  let far = -1;
  for (let k = 0; k < 24; k++) {
    const x = 12 + 40 * rnd();
    const y = 80 + 33 * rnd();
    // The lower the better, near the entrance, but well clear of the others.
    const d = min(24, ...S.dances.map((D) => len(D.cx - x, D.cy - y))) + 0.1 * y;
    if (d > far) [far, best] = [d, [x, y]];
  }
  return best;
}

function newDance(S, b, vig) {
  const [cx, cy] = spot(S);
  // A forager from a rich patch runs longer, keeps at it and draws more followers.
  const D = { b, cx, cy, fl: FIELDS[floor(rnd() * 4)] + 0.12 * (rnd() - 0.5), L: vig ? 11 : 8 + 2.5 * rnd(), tw: vig ? 1.25 : 0.85 + 0.3 * rnd(),
    tr: vig ? 0.9 : 1 + 0.3 * rnd(), tau: 0, side: rnd() < 0.5 ? -1 : 1, n: vig ? 26 : 9 + floor(10 * rnd()), amp: vig ? 1 : 0.65 + 0.2 * rnd(),
    want: vig ? 10 : 6 + floor(3 * rnd()), on: false, foll: [], rec: 0, pc: floor(rnd() * 3) };
  D.th = D.fl - S.sunA;
  b.D = D;
  S.dances.push(D);
  return D;
}

// The bees nearest the dance turn and gather round it.
function recruit(S, D, snap) {
  const free = S.bees.filter((b) => (b.m === CRAWL || b.m === REST) && len(b.x - D.cx, b.y - D.cy) < 24);
  free.sort((a, b) => len(a.x - D.cx, a.y - D.cy) - len(b.x - D.cx, b.y - D.cy));
  for (const b of free) {
    if (D.foll.length >= D.want) break;
    Object.assign(b, { m: FOLLOW, D, a: atan2(b.x - D.cx, -(b.y - D.cy)), t: 5 + 10 * rnd() });
    D.foll.push(b);
    if (snap) {
      const R = D.L / 2 + 3.4;
      b.x = D.cx + R * sin(b.a);
      b.y = D.cy - R * cos(b.a);
      b.h = b.a + PI;
    }
  }
}

function seek(b, tx, ty, sp, dt) {
  const [dx, dy] = [tx - b.x, ty - b.y];
  const r = len(dx, dy);
  if (r > 0.25) {
    const want = atan2(dx, -dy);
    const e = wrap(want - b.h);
    b.h += clamp(e, -5 * dt, 5 * dt);
    const st = min(r, sp * dt) * max(0.15, cos(e));
    b.x += sin(b.h) * st;
    b.y -= cos(b.h) * st;
  }
  return r;
}

function stepDance(S, D, dt) {
  const b = D.b;
  D.th += clamp(wrap(D.fl - S.sunA - D.th), -1.5 * dt, 1.5 * dt);
  const [ux, uy] = [sin(D.th), -cos(D.th)];
  if (!D.on) {
    // The forager hurries up from the entrance to where she will dance.
    b.m = HOME;
    if (seek(b, D.cx - (ux * D.L) / 2, D.cy - (uy * D.L) / 2, D.n > 20 ? 13 : 9, dt) < 1.2) {
      D.on = true;
      b.m = DANCE;
      recruit(S, D, false);
    }
    return;
  }
  D.tau += dt;
  if (D.tau >= D.tw + D.tr) {
    D.tau -= D.tw + D.tr;
    D.side = -D.side;
    if (--D.n <= 0) {
      // Done: she goes back out, and some of her followers go after the flowers.
      [D.gone, b.m, b.wag] = [true, EXIT, 0];
      for (const f of D.foll) [f.m, f.t] = [rnd() < 0.4 ? EXIT : CRAWL, 1 + 2 * rnd()];
      return;
    }
  }
  let want;
  if (D.tau < D.tw) {
    const f = D.tau / D.tw - 0.5;
    b.x = D.cx + ux * D.L * f;
    b.y = D.cy + uy * D.L * f;
    want = D.th;
    b.wag = D.amp;
    b.wp += dt * 2 * PI * 13;
  } else {
    const s = (D.tau - D.tw) / D.tr;
    const ps = D.side * PI * s;
    const [rx, ry] = [ux * cos(ps) - uy * sin(ps), ux * sin(ps) + uy * cos(ps)];
    b.x = D.cx + (rx * D.L) / 2;
    b.y = D.cy + (ry * D.L) / 2;
    want = atan2(-D.side * ry, -D.side * rx);
    b.wag = 0;
  }
  b.h += clamp(wrap(want - b.h), -14 * dt, 14 * dt);
  // Followers keep their place round her, turned to face her, and drift with her.
  D.foll = D.foll.filter((f) => f.m === FOLLOW && f.D === D);
  D.rec -= dt;
  if (D.rec <= 0) {
    D.rec = 1.5;
    if (D.foll.length < D.want) recruit(S, D, false);
  }
  const da = atan2(b.x - D.cx, -(b.y - D.cy));
  for (const f of D.foll) {
    f.a += dt * 0.35 * sin(wrap(da - f.a));
    const R = D.L / 2 + 3.4 + 0.4 * sin(S.t * 2 + f.ph);
    if (seek(f, D.cx + R * sin(f.a), D.cy - R * cos(f.a), 6, dt) < 1.2) f.h += clamp(wrap(atan2(b.x - f.x, -(b.y - f.y)) - f.h), -6 * dt, 6 * dt);
    if ((f.t -= dt) <= 0) [f.m, f.t, f.h] = [CRAWL, 1 + 2 * rnd(), f.h + PI];
  }
}

function crawl(S, b, dt) {
  b.w += (rnd() - 0.5) * 10 * sqrt(dt);
  b.w *= 1 - min(1, 1.5 * dt);
  let want = null;
  const ex = b.x < 4 ? 1 : b.x > W - 4 ? -1 : 0;
  const ey = b.y < TOP + 4 ? 1 : b.y > BOT - 4 ? -1 : 0;
  if (ex || ey) want = atan2(ex, -ey);
  b.h += b.w * dt;
  if (want !== null) b.h += clamp(wrap(want - b.h), -3 * dt, 3 * dt);
  const st = b.v * dt;
  b.x += sin(b.h) * st;
  b.y -= cos(b.h) * st;
}

function step(S, dt) {
  const { bees } = S;
  for (const b of bees) {
    const m = b.m;
    if (m === DANCE || m === HOME || m === FOLLOW) continue;
    if (m === EXIT) {
      if (seek(b, ENX, BOT + 1.5, 7, dt) < 1.5) b.out = true;
      continue;
    }
    // Others give the dancer and her followers room.
    for (const D of S.dances) {
      const [dx, dy] = [b.x - D.cx, b.y - D.cy];
      const r = len(dx, dy);
      if (D.on && r < D.L / 2 + 9) {
        if (m !== CRAWL) b.t = 0;
        b.x += (dx / (r + 0.01)) * 4 * dt;
        b.y += (dy / (r + 0.01)) * 4 * dt;
        b.h += clamp(wrap(atan2(dx, -dy) - b.h), -4 * dt, 4 * dt);
      }
    }
    if (m === CRAWL) crawl(S, b, dt);
    else if (m === REST) b.h += sin(S.t * 6 + b.ph) * 0.5 * dt;
    if ((b.t -= dt) > 0) continue;
    // Backing out of a cell, she turns away.
    if (m === DIP) [b.x, b.y, b.h] = [b.x - sin(b.h) * 1.5, b.y + cos(b.h) * 1.5, b.h + PI * (0.6 + 0.8 * rnd())];
    const u = rnd();
    b.m = CRAWL;
    b.t = 1 + 3 * rnd();
    if (u < 0.28) [b.m, b.t] = [REST, 0.8 + 2.5 * rnd()];
    else if (u < 0.5 && m !== DIP) {
      // Head first into a cell: to feed a larva, take nectar or pack pollen.
      const hx = round(b.x + sin(b.h) * 2.2 - 0.5);
      const hy = round(b.y - cos(b.h) * 2.2 - 0.5);
      if (hx >= 0 && hx < W && hy >= TOP + 2 && hy < BOT - 2) {
        const i = S.cid[hy * W + hx];
        const t = S.type[i];
        if (t !== HONEY && t !== BROOD) {
          const r = floor(i / NC);
          [b.m, b.t] = [DIP, 2 + 4 * rnd()];
          b.x = cellX(r, i % NC) - sin(b.h) * 1.5;
          b.y = cellY(r) + cos(b.h) * 1.5;
        }
      }
    }
  }
  for (const D of S.dances) stepDance(S, D, dt);
  S.dances = S.dances.filter((D) => !D.gone);
  for (const b of bees) if (b.D && (b.D.gone || (b.m !== FOLLOW && b.m !== DANCE && b.m !== HOME))) b.D = null;
  // Bees shoulder each other apart; those still at a cell or dancing stand firm.
  for (const a of bees) {
    if (a.m === REST || a.m === DIP || a.m === DANCE) continue;
    for (const b of bees) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (abs(dx) > 3.6 || abs(dy) > 3.6 || b === a) continue;
      const r = len(dx, dy);
      if (r < 3.6 && r > 0.01) {
        a.x += (dx / r) * (3.6 - r) * 0.25;
        a.y += (dy / r) * (3.6 - r) * 0.25;
      }
    }
  }
  S.bees = bees.filter((b) => !b.out);
}

export function setup(params) {
  const S = { t: 0, started: false, sunA: 0, sunK: 9, next: 6, add: 0, c0: 4.2, c1: 8.5, cd: 0.55, bees: [], dances: [] };
  for (const k of ["cid", "cid2"]) S[k] = new Int16Array(N);
  for (const k of ["hd", "dx", "dy", "expo", "X", "amb", "pool", "sun"]) S[k] = new Float32Array(N);
  for (const k of ["base", "A", "jit"]) S[k] = new Float32Array(N * 3);
  for (const k of ["age", "tint", "gap"]) S[k] = new Float32Array(NR * NC);
  for (const k of ["type", "pol"]) S[k] = new Uint8Array(NR * NC);
  grid(S);
  layout(S);
  paint(S);
  for (let p = 0; p < N; p++) {
    const [x, y] = [p % W, (p / W) | 0];
    S.amb[p] = 0.74 + 0.2 * (1 - y / H) + 0.03 * sin(x * 0.11 + y * 0.05) - 0.12 * ((x - 31.5) / 32) ** 4;
    S.pool[p] = 0.42 + 0.6 * exp(-((x - 40) ** 2 + (y - 74) ** 2) / 3000);
    const j = 0.94 + 0.12 * hash(p, 19);
    for (let c = 0; c < 3; c++) S.jit[p * 3 + c] = j * (0.97 + 0.06 * hash(p, 20 + c));
  }
  params.s = S;
}

function start(S, n) {
  // Bees thickest on the brood, two dances already going.
  for (let k = 0; k < n; k++) {
    let x, y;
    for (let j = 0; j < 4; j++) {
      x = 2 + 60 * rnd();
      y = TOP + 3 + (BOT - TOP - 6) * rnd();
      if (rnd() < 0.35 + 0.65 * sm(30, 70, y)) break;
    }
    newBee(S, x, y, rnd() * 6.28);
  }
  for (let k = 0; k < 2; k++) {
    const b = newBee(S, 0, 0, 0);
    const D = newDance(S, b, false);
    Object.assign(D, { fl: k ? 0.08 : -0.1, cx: k ? 20 : 43, cy: k ? 111 : 102, on: true, tau: rnd() * (D.tw + D.tr), rec: 1.5 });
    D.th = D.fl - S.sunA;
    b.m = DANCE;
    stepDance(S, D, 0);
    b.h = D.tau < D.tw ? D.th : b.h;
    recruit(S, D, true);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  S.light = clamp(k[0], 0, 1);
  const tempo = clamp(k[1], 0.2, 3) / 2;
  const want = round(clamp(k[2], 80, 240));
  const sk = clamp(k[3], -1, 1);
  S.sunA = sk * PI;
  if (abs(sk - S.sunK) > 0.002) sunPatch(S, sk);
  if (!S.started) {
    S.started = true;
    start(S, want);
  }
  const d = dt * tempo;
  S.t += d;
  // Clouds cross the sun now and then; the first one early.
  if (S.t > S.c1 + 1.5) {
    S.c0 = S.t + 8 + 20 * rnd();
    S.c1 = S.c0 + 3 + 6 * rnd();
    S.cd = 0.4 + 0.5 * rnd();
  }
  S.cloud = 1 - S.cd * sm(S.c0, S.c0 + 1.5, S.t) * sm(S.c1 + 1.5, S.c1, S.t);
  const vig = input.btnPressed && input.btnPressed[0];
  if ((S.next -= d) <= 0 || vig) {
    if (S.dances.length < (vig ? 4 : 3)) {
      const b = newBee(S, ENX + 4 * (rnd() - 0.5), BOT + 1, 0);
      b.m = HOME;
      newDance(S, b, vig);
    }
    if (!vig) S.next = 5 + 8 * rnd();
  }
  // Bees walk in from the sides, or go out at the entrance, to match the knob.
  let ord = 0;
  for (const b of S.bees) if (b.m <= FOLLOW) ord++;
  if ((S.add -= dt) <= 0) {
    S.add = 0.1;
    if (ord < want) {
      const l = rnd() < 0.5;
      newBee(S, l ? -3 : W + 3, TOP + 8 + (BOT - TOP - 16) * rnd(), l ? PI / 2 : -PI / 2).t = 1.5;
    } else if (ord > want + 2) {
      const b = S.bees.find((b) => b.m === CRAWL);
      if (b) b.m = EXIT;
    }
  }
  step(S, d);
}

// One bee into the albedo: her body worked out on a 12 x 12 patch first,
// then her shadow a step down and right, head, thorax, banded abdomen, wings.
const PC = new Float32Array(144);
const PP = new Uint8Array(144);
function bee(S, b) {
  const { A, X } = S;
  const [s, fx, fy, dip, wg] = [b.s, sin(b.h), -cos(b.h), b.m === DIP, b.wag > 0];
  const wag = wg ? b.wag * sin(b.wp) : b.m === REST ? 0.15 * sin(S.t * 9 + b.ph) : 0;
  const [bl, th, am] = [wg ? 0.4 : 0, THX[b.tone], AMB[b.tone]];
  const shim = 0.24 + 0.14 * sin(S.t * 2.3 + b.ph + b.x * 0.3);
  // A box round her, the whole patch for a dancer and her blur.
  const ax = wg ? 5 : s * (3.2 * abs(fx) + 1.9 * abs(fy)) + 0.5;
  const ay = wg ? 5 : s * (3.2 * abs(fy) + 1.9 * abs(fx)) + 0.5;
  const [x0, y0] = [floor(b.x - ax), floor(b.y - ay)];
  const nw = min(12, floor(b.x + ax) - x0 + 2);
  const nh = min(12, floor(b.y + ay) - y0 + 2);
  for (let j = 0, k = 0; j < nh; j++)
    for (let i = 0; i < nw; i++, k++) {
      const X0 = x0 + i + 0.5 - b.x;
      const Y0 = y0 + j + 0.5 - b.y;
      const u = (X0 * fx + Y0 * fy) / s;
      const v = (Y0 * fx - X0 * fy) / s - wag * (0.3 + 0.7 * clamp(-u / 2.5, 0, 1));
      PC[k] = shape(u, v, s, dip, bl);
      PP[k] = PART;
    }
  for (let j = 0, k = 0; j < nh; j++)
    for (let i = 0; i < nw; i++, k++) {
      const px = x0 + i;
      const py = y0 + j;
      const c = PC[k];
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const p = py * W + px;
      const q = p * 3;
      const sh = i && j ? PC[k - nw - 1] : 0;
      if (sh > 0) {
        const f = 1 - 0.7 * sh * (1 - c);
        A[q] *= f;
        A[q + 1] *= f;
        A[q + 2] *= f;
      }
      const X0 = px + 0.5 - b.x;
      const Y0 = py + 0.5 - b.y;
      const u = (X0 * fx + Y0 * fy) / s;
      const v = (Y0 * fx - X0 * fy) / s - wag * (0.3 + 0.7 * clamp(-u / 2.5, 0, 1));
      // A waggling dancer buzzes her wings into a pale blur round her.
      let wa = wg ? 0.55 * clamp(1.6 - len((u + 0.7) / 1.5, v / 1.7), 0, 1) : 0;
      if (c <= 0 && wa <= 0) continue;
      const pt = PP[k];
      const col = pt === 1 ? HEAD : pt === 2 ? th : null;
      const st = u > -0.85 ? 1 : u > -1.35 ? 0 : u > -1.9 ? 0.8 : 0;
      if (u > -2.2 && u < 0.3 && abs(v) > 0.35 && abs(v) < 1.15) wa = max(wa, shim);
      const a = max(c, wa);
      for (let n = 0; n < 3; n++) {
        let e = col ? col[n] : DARK[n] + (am[n] - DARK[n]) * st;
        e += (WING[n] - e) * wa;
        A[q + n] += (e - A[q + n]) * a;
      }
      X[p] += (1 - X[p]) * a;
    }
  // A forager home from the field carries her pollen loads on her hind legs.
  if (b.D && (b.m === DANCE || b.m === HOME)) {
    const c = POLLENS[b.D.pc];
    for (const sd of [-1, 1]) {
      const px = round(b.x + s * (-0.7 * fx - sd * 1.25 * fy) - 0.5);
      const py = round(b.y + s * (-0.7 * fy + sd * 1.25 * fx) - 0.5);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const q = (py * W + px) * 3;
      [A[q], A[q + 1], A[q + 2], X[py * W + px]] = [...c, 1];
    }
  }
}

// Coverage of a bee's body at (u along, v across) in body lengths of
// about five LEDs; PART says which piece.
let PART = 0;
function shape(u, v, s, dip, bl) {
  let c = clamp((1 - len((u + 1.3) / 1.5, v / (1.12 + bl))) * 1.2 * s + 0.5, 0, 1);
  PART = 3;
  if (!dip || u < 0.3) {
    const k = clamp((1 - len((u - 0.5) / 0.8, v)) * 0.9 * s + 0.5, 0, 1);
    if (k > c) [c, PART] = [k, 2];
  }
  if (!dip) {
    const k = clamp((1 - len((u - 1.65) / 0.6, v / 0.75)) * 0.7 * s + 0.5, 0, 1);
    if (k > c) [c, PART] = [k, 1];
  }
  return c;
}

const knee = (c) => (c < 190 ? c : 190 + 65 * (1 - exp(-(c - 190) / 65)));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { A, X, base, expo, amb, sun, pool, jit } = S;
  A.set(base);
  X.set(expo);
  for (const b of S.bees) if (b.m !== DANCE) bee(S, b);
  for (const b of S.bees) if (b.m === DANCE) bee(S, b);
  // The curtain closes on the sun first; the room light goes from daylight
  // to a warm lamp over the hive by 0.5, and from that to the red lamp.
  const L = S.light;
  const [w, rd, pw] = [sm(0, 0.5, L), sm(0.5, 1, L), sm(0.15, 0.6, L)];
  const dc = [0, 1, 2].map((c) => (DAYC[c] + (WARM[c] - DAYC[c]) * w + (REDC[c] - WARM[c]) * rd) * (1 - 0.1 * w - 0.1 * rd) * 255);
  const sk = 0.9 * S.cloud * (1 - sm(0, 0.4, L)) * 255;
  const o = [0, 0, 0];
  for (let p = 0; p < N; p++) {
    const q = p * 3;
    const a = amb[p] + (pool[p] - amb[p]) * pw;
    const s = sun[p] * X[p] * sk;
    for (let c = 0; c < 3; c++) o[c] = knee(A[q + c] * (a * dc[c] + s * SUNC[c]) * jit[q + c]) | 0;
    display.setPixel(p % W, (p / W) | 0, o[0], o[1], o[2]);
  }
}
