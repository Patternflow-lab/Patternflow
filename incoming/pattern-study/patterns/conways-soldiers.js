// ===== Patternflow pattern =====
// Title:   Conway's Soldiers
// Family:  algo
// Idea:    Gold soldiers below a white line leapfrog each other across it, each jumped soldier blinking off the board, until the last one lands 1, 2, 3 and then 4 rows past the line with the fewest that can do it (2, 4, 8 and 20); each soldier carries a violet disc of light whose area is its Conway weight, the discs merge as they jump and the last soldier's disc exactly fills the ring of weight 1, and then an endless army floods the board and its gathered light still cannot fill the ring round the marked square on row 5.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Conway's soldiers (John Horton Conway, 1961), pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Row=0..5, Glow=0..1
//
// Knob 1: Hue. Turns the soldiers round the wheel from gold at 0 through green at 0.25, pale blue at 0.5 and magenta at 0.75; the light of the weights swings through the cold hues only, violet at 0, pink at 0.25, violet at 0.5 and cyan at 0.75, so it never goes a muddy orange. The square on row 5 is pink-red at 0.
// Knob 2: Speed. At 2 a jump takes half a second: the 20 soldiers of row 4 line up in 1.4 seconds and make their 19 jumps in 9.5, and the round of all five campaigns takes 39 seconds. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Row. At 0 the campaigns come in turn: row 4 first on squares of 7 LEDs, then the endless army that tries for row 5, then rows 1, 2 and 3 on squares of 11. At 1 to 4 that row's campaign plays over and over (2, 4, 8 or 20 soldiers); at 5 the endless army floods the board again and again.
// Knob 4: Glow. How far the weights glow on the empty board round the target: at 0 a violet diamond about four squares across each way, with bands running in towards the target; at 1 every square on the panel shows its weight, each 0.618 of its neighbour one step nearer.

const W = 64, H = 128, CX = 32;
const { floor, min, max, abs, round, sin, sqrt, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (t) => t * t * (3 - 2 * t);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Conway's weight: a square at taxicab distance d from the target weighs
// X^d with X = (sqrt 5 - 1) / 2 = 1/phi, so X + X^2 = 1. A jump straight
// at the target keeps the weight (X^(d+2) + X^(d+1) = X^d), any other jump
// loses some, so an army that ends with a soldier on the target must start
// at weight 1 or more. For row 5 the whole half-plane below the line
// weighs exactly 1 (the columns sum to phi^3, the rows to X^3), so every
// finite army falls short.
const X = (sqrt(5) - 1) / 2;
// The line is the gap between row 0 and row 1, pixel row 76. A square of
// side s has its rows at y = LINE - s r .. LINE - s (r - 1).
const LINE = 76.5;
// The board kept: columns -6..6, rows -10..8.
const C0 = 6, R0 = 10, NC = 13, NR = 19;
const key = (c, r) => (c + C0) + (r + R0) * NC;

// The four campaigns, each the fewest soldiers that can reach its row, as
// starting squares [column, row] (row 0 is just below the line) and jumps
// [from column, from row, to column, to row]. Found offline by a search that
// kept only armies of weight 1 or more and pruned any jump that would drop
// the weight under 1; for rows 1 to 3 the armies are the column, the T and
// the cross, and the 20 of row 4 came out with 19 jumps, all of them
// straight at the target, so each army here weighs exactly 1 from the
// first jump to the last. Rows 1 to 3 stand on squares of 11 LEDs, row 4
// and the endless army on squares of 7.
const CAMP = [
  null,
  { s: 11, start: [[0, 0], [0, -1]], moves: [[0, -1, 0, 1]] },
  { s: 11, start: [[-2, 0], [-1, 0], [0, 0], [0, -1]], moves: [[0, -1, 0, 1], [-2, 0, 0, 0], [0, 0, 0, 2]] },
  {
    s: 11,
    start: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, -1], [0, -2], [0, -3]],
    moves: [[0, -1, 0, 1], [-2, 0, 0, 0], [0, 0, 0, 2], [2, 0, 0, 0], [0, -3, 0, -1], [0, -1, 0, 1], [0, 1, 0, 3]],
  },
  {
    s: 7,
    start: [[-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [-2, -2], [-1, -2], [0, -2], [1, -2], [-2, -3], [0, -3]],
    moves: [
      [-2, -1, -2, 1], [-1, -1, -1, 1], [-2, 1, 0, 1], [0, 0, 0, 2], [-4, 0, -2, 0], [2, 0, 0, 0], [0, -1, 0, 1], [0, 1, 0, 3],
      [1, -2, 1, 0], [4, 0, 2, 0], [2, 0, 0, 0], [-2, -3, -2, -1], [-3, -1, -1, -1], [-1, -2, -1, 0], [0, -3, 0, -1], [0, -1, 0, 1],
      [-2, 0, 0, 0], [0, 0, 0, 2], [0, 2, 0, 4],
    ],
  },
  // Row 5: the endless army, a whole row at a time.
  { s: 7 },
];
// Story seconds (one a second at Speed 2): a jump, the part of it in the
// air, the soldiers' line-up, the wait before the first jump, the win, the
// fade, and for the endless army one row every FLOOD.
const STEP = 0.5, FLY = 0.36, LINEUP = 1.4, WAIT = 0.4, WIN = 1.6, FADE = 0.6, FLOOD = 0.3, ROWS5 = 8, HOLD5 = 2;
// Soldier radius in squares, and the order campaigns come in at Row 0.
const RAD = 0.42, ORDER = [4, 5, 1, 2, 3];
// The radius, in squares, of the light disc of weight 1.
const HALO = 2.4;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, row: 0, glowK: 0.06,
    camp: 4, ci: 0, phase: "lineup", pt: 0,
    s: 7, sFrom: 7, sTo: 7, T: 4, Tfrom: 4, Tto: 4, zoomT: 0.6,
    occ: new Uint8Array(NC * NR), amp: new Float32Array(NC * NR), fl: new Float32Array(NC * NR),
    order: [], rec: 0, mi: 0, fly: null, gauge: 0, rows5: 0, t: 0, flow: 0,
  };
  enter(params.s, 4, true);
}

const weight = (c, r, n) => pow(X, abs(c) + abs(r - n));

function enter(S, camp, now) {
  S.camp = camp;
  const C = CAMP[camp];
  S.occ.fill(0);
  S.amp.fill(0);
  S.fl.fill(0);
  S.fly = null;
  S.mi = 0;
  S.rec = 0;
  S.rows5 = 0;
  S.sFrom = S.s;
  S.sTo = C.s;
  S.Tfrom = S.T;
  S.Tto = camp;
  S.zoomT = abs(S.sTo - S.sFrom) > 0.01 ? 1.0 : abs(S.Tto - S.Tfrom) > 0.01 ? 0.7 : 0.4;
  S.phase = now ? (camp === 5 ? "flood" : "lineup") : "zoom";
  if (now) (S.s = S.sTo), (S.T = S.Tto);
  S.pt = 0;
  // The line-up: nearest the line first, from the middle out.
  if (C.start) S.order = C.start.slice().sort((a, b) => b[1] - a[1] || abs(a[0]) - abs(b[0]) || a[0] - b[0]);
}

function next(S) {
  if (S.row > 0) enter(S, S.row, false);
  else {
    S.ci = (S.ci + 1) % ORDER.length;
    enter(S, ORDER[S.ci], false);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.glowK = cl(k[3], 0, 1);
  const row = cl(round(k[2]), 0, 5);
  if (row !== S.row) {
    S.row = row;
    if (row > 0) enter(S, row, true);
    else (S.ci = 0), enter(S, 4, true);
  }
  const g = (d * S.speed) / 2;
  S.t += g;
  S.pt += g;
  S.flow += g * 0.7;
  const C = CAMP[S.camp], { occ, amp, fl } = S;
  // Soldiers grow in over 0.15 s, the jumped and the faded shrink away, and
  // white flashes die down.
  for (let i = 0; i < occ.length; i++) {
    if (occ[i]) amp[i] = min(1, amp[i] + g / 0.15);
    else if (amp[i] > 0) amp[i] = max(0, amp[i] - g / 0.22);
    if (fl[i] > 0) fl[i] = max(0, fl[i] - g / 0.35);
  }
  if (S.phase === "zoom") {
    const u = ss(cl(S.pt / S.zoomT, 0, 1));
    S.s = S.sFrom + (S.sTo - S.sFrom) * u;
    S.T = S.Tfrom + (S.Tto - S.Tfrom) * u;
    if (S.pt >= S.zoomT) (S.phase = S.camp === 5 ? "flood" : "lineup"), (S.pt = 0), (S.s = S.sTo), (S.T = S.Tto);
  } else if (S.phase === "lineup") {
    const iv = min(0.25, LINEUP / S.order.length);
    while (S.rec < S.order.length && S.pt >= S.rec * iv) {
      const [c, r] = S.order[S.rec++], i = key(c, r);
      occ[i] = 1;
      fl[i] = 0.8;
    }
    if (S.rec >= S.order.length && S.pt >= S.order.length * iv + WAIT) (S.phase = "jump"), (S.pt = 0), (S.mi = 0);
  } else if (S.phase === "jump") {
    const m = C.moves[S.mi], p = S.pt / FLY;
    if (!S.fly) {
      // Lift off: the soldier leaves its square and is in the air.
      const ia = key(m[0], m[1]);
      occ[ia] = 0;
      amp[ia] = 0;
      S.fly = { x0: m[0], y0: m[1], x1: m[2], y1: m[3], bx: (m[0] + m[2]) / 2, by: (m[1] + m[3]) / 2, over: false };
    }
    if (!S.fly.over && p >= 0.5) {
      // Over the top: the jumped soldier blinks white and goes.
      const ib = key(S.fly.bx, S.fly.by);
      occ[ib] = 0;
      fl[ib] = 1;
      S.fly.over = true;
    }
    if (p >= 1 && !S.fly.landed) {
      const ic = key(S.fly.x1, S.fly.y1);
      occ[ic] = 1;
      amp[ic] = 1;
      fl[ic] = 0.55;
      S.fly.landed = true;
    }
    if (S.pt >= STEP) {
      S.fly = null;
      S.mi++;
      S.pt -= STEP;
      if (S.mi >= C.moves.length) S.phase = "win";
    }
  } else if (S.phase === "win") {
    if (S.pt >= WIN) (S.phase = "fade"), (S.pt = 0);
  } else if (S.phase === "flood") {
    // A whole row of the endless army at a time, from the line down to the
    // bottom of the panel. Each row counts as the whole infinite row.
    const want = min(ROWS5, floor(S.pt / FLOOD) + 1);
    while (S.rows5 < want) {
      const r = -S.rows5;
      if (r >= -R0) for (let c = -C0; c <= C0; c++) (occ[key(c, r)] = 1), (fl[key(c, r)] = 0.5);
      S.rows5++;
    }
    if (S.pt >= ROWS5 * FLOOD + HOLD5) (S.phase = "fade"), (S.pt = 0);
  } else if (S.phase === "fade") {
    const f = 1 - cl(S.pt / FADE, 0, 1);
    for (let i = 0; i < occ.length; i++) if (occ[i]) amp[i] = min(amp[i], f);
    if (S.pt >= FADE) next(S);
  }
  // The gauge on the line: the army's weight against its target, 1 filling
  // the line. The soldier in the air carries its own weight and, once it is
  // over, the jumped one's too, so a straight jump never moves the gauge.
  let wsum = 0;
  if (S.camp === 5) wsum = 1 - pow(X, S.rows5);
  else {
    const n = S.camp;
    for (let r = -R0; r < NR - R0; r++)
      for (let c = -C0; c <= C0; c++) {
        const i = key(c, r);
        if (occ[i]) wsum += amp[i] * weight(c, r, n);
      }
    if (S.fly && !S.fly.landed) wsum += weight(S.fly.x0, S.fly.y0, n) + (S.fly.over ? weight(S.fly.bx, S.fly.by, n) : 0);
  }
  if (S.phase === "fade") wsum = min(wsum, 1 - cl(S.pt / FADE, 0, 1));
  S.gauge += (wsum - S.gauge) * min(1, g * 10);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const s = S.s, T = S.T, n = S.camp, { occ, amp, fl } = S;
  // The glow keeps to the cold hues; where the soldiers' hue comes near it
  // (Hue about 0.5 to 0.6) the soldiers pale towards white to stand apart.
  const hs = 0.12 + S.hue, hg = 0.725 + 0.225 * sin(2 * PI * S.hue);
  const near = cl(1 - abs(((hs - hg + 1.5) % 1) - 0.5) / 0.2, 0, 1);
  const sol = hsv(hs, 0.85 - 0.55 * near, 1);
  const glowC = hsv(hg, 0.72, 1);
  const mark = hsv(0.95 + S.hue, 0.8, 1);
  // How far the weights glow: the square at distance d shows X^(gam d).
  const gam = 0.82 - 0.62 * S.glowK, amp0 = 0.62;
  const xg = pow(X, gam);
  // The row-5 square blinks while the endless army stands.
  const blink5 = n === 5 && S.phase !== "zoom" ? 0.55 + 0.45 * sin(S.t * 9) : 1;
  // The target ring brightens on the win.
  const winK = S.phase === "win" ? 0.5 + 0.5 * sin(S.pt * 14) : 0;
  const half = s / 2 - 0.7;
  const fly = S.fly && !S.fly.landed ? S.fly : null;
  let fx = 0, fy = 0, fr2 = 0;
  if (fly) {
    const p = ss(cl(S.pt / FLY, 0, 1));
    fx = fly.x0 + (fly.x1 - fly.x0) * p;
    fy = fly.y0 + (fly.y1 - fly.y0) * p;
    // The hop: the soldier swells as it rises towards us and shrinks as it lands.
    const rr = RAD * (1 + 0.38 * sin(PI * p));
    fr2 = rr * rr;
  }
  const gw = S.gauge * 32;
  // Each soldier's weight as light: a disc whose area is its weight, so the
  // light on the board is the army's weight. When a soldier jumps straight
  // at the target its disc swallows the jumped one's and the light stays
  // the same; the last soldier on the target holds a disc of weight 1, the
  // size of the ring drawn round it.
  const halos = [];
  if (n === 5) {
    // The endless army stands too close for its discs to show: its light is
    // gathered on the target instead, a disc of area 1 - X^k after k whole
    // rows, which creeps towards the ring and never fills it.
    if (S.phase !== "zoom") halos.push(0, 5, HALO * HALO * S.gauge);
  } else {
    for (let r = -R0; r < NR - R0; r++)
      for (let c = -C0; c <= C0; c++) {
        const i = key(c, r);
        if (!occ[i] || amp[i] <= 0) continue;
        const w = weight(c, r, n) * amp[i];
        if (w > 0.02) halos.push(c, r, HALO * HALO * w);
      }
    if (fly) halos.push(fx, fy, HALO * HALO * (weight(fly.x0, fly.y0, n) + (fly.over ? weight(fly.bx, fly.by, n) : 0)));
  }
  const nh = halos.length;
  const ringR = HALO, ringK = n === 5 ? blink5 : 0.4;
  for (let y = 0; y < H; y++) {
    const v = (LINE - (y + 0.5)) / s + 0.5, r = round(v), fv = v - r;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - CX) / s, c = round(u), fu = u - c;
      let R = 0.012, G = 0.01, B = 0.03;
      const ox = abs(fu) * s, oy = abs(fv) * s;
      if (y === 76) {
        // The line, dim, lit from the middle out by the army's weight.
        const dx = abs(x + 0.5 - CX);
        R = G = B = 0.24;
        if (dx < gw) (R = 0.55 + 0.45 * sol[0]), (G = 0.55 + 0.45 * sol[1]), (B = 0.55 + 0.45 * sol[2]);
        else if (n === 5 && S.phase !== "zoom" && dx > min(30, gw)) (R = mark[0] * blink5), (G = mark[1] * blink5), (B = mark[2] * blink5);
      } else if (ox < half && oy < half) {
        // A square of the board, lit by its weight against the target row.
        // Bands run in along the rings of equal distance towards the
        // target, two squares apart.
        const dist = abs(c) + abs(r - T);
        const gl = amp0 * pow(xg, dist) * (0.62 + 0.38 * sin(2 * PI * (dist / 2 + S.flow))) + (r <= 0 ? 0.088 : 0.035);
        R = glowC[0] * gl;
        G = glowC[1] * gl;
        B = glowC[2] * gl;
        if (c === 0 && r === 5) {
          // The square no army reaches: a red ring and a cross.
          if (ox > half - 1 || oy > half - 1 || abs(ox - oy) < 0.6) (R = mark[0] * blink5), (G = mark[1] * blink5), (B = mark[2] * blink5);
        } else if (c === 0 && r === n && n < 5 && !(amp[key(0, n)] > 0) && (ox > half - 1 || oy > half - 1)) {
          const k = 0.55 + 0.45 * winK;
          R = max(R, k * (0.6 + 0.4 * sol[0]));
          G = max(G, k * (0.6 + 0.4 * sol[1]));
          B = max(B, k * (0.6 + 0.4 * sol[2]));
        }
        if (c >= -C0 && c <= C0 && r >= -R0 && r < NR - R0) {
          const i = key(c, r), a = amp[i];
          if (a > 0) {
            const rad = RAD * a * (n < 5 && S.phase === "win" && c === 0 && r === n ? 1 + 0.12 * winK : 1);
            if (fu * fu + fv * fv < rad * rad) {
              const w = fl[i];
              R = sol[0] + (1 - sol[0]) * w;
              G = sol[1] + (1 - sol[1]) * w;
              B = sol[2] + (1 - sol[2]) * w;
            }
          }
        }
      }
      // The halos add up where they overlap.
      let hl = 0;
      for (let h = 0; h < nh; h += 3) {
        const du = u - halos[h], dv = v - halos[h + 1];
        if (du * du + dv * dv < halos[h + 2]) hl += 0.3;
      }
      // The ring of weight 1 round the target: what the army has to fill.
      const tu = u, tv = v - n, td = sqrt(tu * tu + tv * tv) * s;
      if (abs(td - ringR * s) < 0.55 && !(R > 0.5 && G > 0.3)) {
        const k = n === 5 ? ringK : 0.4;
        R = max(R, (n === 5 ? mark[0] : 0.8) * k);
        G = max(G, (n === 5 ? mark[1] : 0.8) * k);
        B = max(B, (n === 5 ? mark[2] : 0.85) * k);
      }
      if (hl > 0 && !(G > 0.3 && R > 0.5 && fu * fu + fv * fv < RAD * RAD)) {
        R += glowC[0] * hl;
        G += glowC[1] * hl;
        B += glowC[2] * hl;
      }
      if (fly) {
        const du = u - fx, dv = v - fy;
        if (du * du + dv * dv < fr2) (R = 0.6 + 0.4 * sol[0]), (G = 0.6 + 0.4 * sol[1]), (B = 0.6 + 0.4 * sol[2]);
      }
      display.setPixel(x, y, round(255 * cl(R, 0, 1)), round(255 * cl(G, 0, 1)), round(255 * cl(B, 0, 1)));
    }
  }
}
