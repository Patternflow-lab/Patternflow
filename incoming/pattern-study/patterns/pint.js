// ===== Patternflow pattern =====
// Title:   Pint
// Family:  cells
// Idea:    A tap pours a pint as tall as the panel against a dark bar, the cloudy beer clears from the bottom up under rising chains of bubbles while the foam head coarsens into bright polygonal cells, and someone drinks it down in sips that leave lacing rings on the glass before it is poured again.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the pour, the settling surge and the lacing of a pint at the bar
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Beer=0..1, Speed=0.2..3, Fizz=4..20, Head=0..1
//
// Knob 1: Beer. What is on tap: a pale lager at 0, an amber ale at 0.35, a red ale at 0.65 and a stout at 1, whose cream-brown surge settles black from the bottom up.
// Knob 2: Speed. How fast the bar runs: at 2 a pint pours in 6 s, starts to go 5 s later in five sips 5 s apart and is poured again; at 0.2 it all runs ten times slower.
// Knob 3: Fizz. How many nucleation sites stream bubbles, from 4 to 20, and how thick the haze of fine bubbles is, so how long a lager takes to clear: about 6 s at 4 and 17 s at 20.
// Knob 4: Head. How tall the foam head stands, from 12 rows to 32, and how fast its small bubbles coarsen into large cells.

const W = 64;
const H = 128;
const N = W * H;
const CX = 31.5;
// The glass: rim row, inside floor row, and the bar top it stands on.
const RIM = 14;
const FLOOR = 118;
const BAR = 124;
// Bar states.
const POUR = 0;
const REST = 1;
// Clear and cloudy body, and head, for lager, amber ale, red ale and stout.
const BEERS = [
  [0, [238, 178, 28], [204, 186, 138], [238, 236, 226]],
  [0.35, [216, 106, 18], [196, 146, 104], [240, 230, 206]],
  [0.65, [168, 38, 18], [176, 112, 90], [238, 222, 198]],
  [1, [20, 10, 6], [152, 114, 82], [224, 198, 152]],
];
const MAXB = 700;
const FOAM = 640;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Inside half-width of the shaker glass at a row: 26 LEDs at the rim, 20 at the floor.
function half(y) {
  return 26 - (6 * (clamp(y, RIM, FLOOR) - RIM)) / (FLOOR - RIM);
}

function beerAt(b) {
  let i = 0;
  while (i < BEERS.length - 2 && BEERS[i + 1][0] < b) i++;
  const A = BEERS[i];
  const B = BEERS[i + 1];
  const f = clamp((b - A[0]) / (B[0] - A[0]), 0, 1);
  const mix = (k) => A[k].map((v, j) => v + (B[k][j] - v) * f);
  return { clear: mix(1), cloudy: mix(2), head: mix(3) };
}

export function setup(params) {
  const P = params;
  P.buf = new Float32Array(N * 3);
  P.bx = new Float32Array(MAXB);
  P.by = new Float32Array(MAXB);
  P.bv = new Float32Array(MAXB);
  P.nb = 0;
  P.fx = new Float32Array(FOAM);
  P.fv = new Float32Array(FOAM);
  P.fu = new Float32Array(FOAM);
  P.nf = 0;
  P.wet = new Float32Array(H);
  // The bar lights' reflection down the left of the glass and a fainter one
  // on the right, and where along a row the climbing glint sits.
  P.hl = new Float32Array(N);
  P.bump = new Float32Array(W);
  for (let x = 0; x < W; x++) P.bump[x] = 0.8 * Math.sin(x * 0.9 + 1.3);
  P.glx = new Float32Array(N);
  for (let y = RIM; y < FLOOR; y++)
    for (let x = 0; x < W; x++) {
      const hw = half(y);
      const dx = x + 0.5 - CX;
      P.hl[y * W + x] = 255 * (Math.exp(-(((dx + hw - 3.5) / 1.3) ** 2)) * 0.32 + Math.exp(-(((dx - hw + 2.5) / 0.9) ** 2)) * 0.12) * (0.75 + 0.25 * Math.sin(y * 0.11));
      P.glx[y * W + x] = 204 * Math.exp(-(((dx + hw - 3.5) / 1.6) ** 2));
    }
  // A smooth noise field for the haze and the surge, tiled every 128 rows.
  P.noise = new Float32Array(N);
  const g = [];
  for (let i = 0; i < 17 * 33; i++) g.push(Math.random());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = x / 4;
      const gy = y / 4;
      const i = Math.floor(gx);
      const j = Math.floor(gy);
      const u = gx - i;
      const v = gy - j;
      const s = (a, b) => g[(b % 32) * 17 + (a % 16)];
      const su = u * u * (3 - 2 * u);
      const sv = v * v * (3 - 2 * v);
      P.noise[y * W + x] = (s(i, j) * (1 - su) + s(i + 1, j) * su) * (1 - sv) + (s(i, j + 1) * (1 - su) + s(i + 1, j + 1) * su) * sv;
    }
  Object.assign(P, {
    T: 0,
    t: 0,
    mode: POUR,
    modeT: 0,
    level: FLOOR,
    headH: 0,
    foamAge: 0,
    front: FLOOR + 4,
    sips: 0,
    sipFrom: 0,
    sipTo: 0,
    sipT: -1,
    laces: [],
    siteT: new Float32Array(20),
    streamTop: 11,
    beer: 0,
    fizz: 4,
    head: 0.06,
    started: false,
  });
  freshFoam(P);
}

// The head made by a pour: small bubbles packed tight, each with a rank that
// says how soon it pops or is swallowed by its neighbours as the foam coarsens.
function freshFoam(P) {
  P.nf = 0;
  P.foamAge = 0;
  // One bubble in each 1.9 LED square, jittered.
  for (let j = 0; j < 19; j++)
    for (let i = 0; i < 29 && P.nf < FOAM; i++) {
      P.fx[P.nf] = 4.5 + (i + 0.15 + 0.7 * Math.random()) * 1.9;
      P.fv[P.nf] = (j + 0.15 + 0.7 * Math.random()) * 1.9;
      P.fu[P.nf] = Math.random();
      P.nf++;
    }
  P.bStart = new Int32Array(16 * 10 + 1);
  P.bItem = new Int32Array(FOAM);
  P.bOf = new Int32Array(FOAM);
}

// The head's full height for the Head knob, and the liquid level of a full pint.
const headFull = (P) => 12 + 20 * P.head;
const fullLevel = (P) => RIM + 1 + headFull(P);

function startPour(P) {
  P.mode = POUR;
  P.modeT = 0;
  P.front = FLOOR + 4;
  P.sips = 0;
  freshFoam(P);
  P.headH = Math.min(P.headH, 3);
}

function step(P, h) {
  P.T += h;
  P.modeT += h;
  P.foamAge += h;
  const stout = clamp((P.beer - 0.6) / 0.4, 0, 1);
  const full = fullLevel(P);
  if (P.mode === POUR) {
    // About 15 rows a second; the falling stream whips up the head.
    P.level = Math.max(full, P.level - h * 15);
    P.headH = Math.min(headFull(P) * (P.level > full + 0.5 ? 0.9 : 1), P.headH + h * 5);
    P.foamAge = 0;
    P.streamTop = 11;
    if (P.level <= full) {
      P.mode = REST;
      P.modeT = 0;
      P.nextSip = 4.6;
    }
  } else {
    // The stream's tail falls once the tap closes.
    P.streamTop += h * (20 + 140 * P.modeT);
    // Clearing climbs from the floor: quick for lager, a slow surge for stout.
    P.front -= (h * (11 - 6 * stout) * 1.4) / (0.6 + P.fizz / 10);
    // The head drains and pops down to about 60% of its height.
    const target = headFull(P) * (0.6 + 0.4 * Math.exp(-P.foamAge / 14));
    P.headH += (target - P.headH) * Math.min(1, h * 0.8);
    if (P.sipT < 0 && P.modeT >= P.nextSip) {
      if (P.sips >= 5) startPour(P);
      else {
        P.sipT = 0;
        P.sipFrom = P.level;
        P.sipTo = Math.min(FLOOR - 16, P.level + (FLOOR - full) / 6);
        P.laces.push({ y: P.level - P.headH, k: Math.random() * 97 });
        if (P.laces.length > 6) P.laces.shift();
      }
    }
    if (P.sipT >= 0) {
      P.sipT += h;
      const f = Math.min(1, P.sipT / 1.2);
      const old = P.level;
      P.level = P.sipFrom + (P.sipTo - P.sipFrom) * f * f * (3 - 2 * f);
      for (let y = Math.max(0, Math.floor(old)); y < P.level && y < H; y++) P.wet[y] = 1;
      if (f >= 1) {
        P.sipT = -1;
        P.sips++;
        P.nextSip = P.modeT + (P.sips >= 5 ? 3 : 5);
      }
    }
  }
  if (P.mode === POUR) P.laces.length = Math.min(P.laces.length, P.laces.filter((l) => l.y < P.level - P.headH - 1).length);
  for (let y = 0; y < H; y++) P.wet[y] *= Math.exp(-h / 5);
  bubbles(P, h);
}

// Carbonation: chains of bubbles from nucleation sites on the floor and walls,
// speeding up and swelling as they rise.
function bubbles(P, h) {
  const n = Math.round(P.fizz);
  const every = 0.3 / (0.6 + (0.4 * n) / 4);
  for (let i = 0; i < n; i++) {
    P.siteT[i] -= h;
    if (P.siteT[i] > 0) continue;
    P.siteT[i] += every * (0.8 + 0.4 * Math.random()) * (1 + 0.5 * ((i * 0.71) % 1));
    if (P.nb >= MAXB) continue;
    let x;
    let y;
    if (i % 4 === 3) {
      y = 44 + ((i * 0.37) % 1) * 66;
      x = CX + (i % 8 === 3 ? -1 : 1) * (half(y) - 1.2);
    } else {
      y = FLOOR - 0.5;
      x = CX + (((i * 0.618 + 0.13) % 1) - 0.5) * 2 * (half(FLOOR) - 3);
    }
    if (y <= P.level + 1) continue;
    P.bx[P.nb] = x;
    P.by[P.nb] = y;
    P.bv[P.nb] = 5;
    P.nb++;
  }
  const { bx, by, bv } = P;
  const top = P.level + 0.5;
  for (let i = 0; i < P.nb; i++) {
    const v = Math.min(32, bv[i] + h * 16);
    bv[i] = v;
    by[i] -= v * h;
    if (by[i] > top) continue;
    // At the surface: the last bubble takes this one's place.
    P.nb--;
    bx[i] = bx[P.nb];
    by[i] = by[P.nb];
    bv[i] = bv[P.nb];
    i--;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 4, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.beer = clamp(k[0], 0, 1);
  const rate = clamp(k[1], 0, 3) / 2;
  P.fizz = clamp(k[2], 4, 20);
  P.head = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    // The pint has been pouring for a few seconds when the panel opens.
    for (let i = 0; i < 50; i++) step(P, 1 / 30);
    for (let i = 0; i < 90; i++) step(P, rate / 30);
  }
  P.t += dt;
  step(P, dt * rate);
}

function add(buf, p, r, g, b) {
  buf[p * 3] += r;
  buf[p * 3 + 1] += g;
  buf[p * 3 + 2] += b;
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  const { clear, cloudy, head } = beerAt(P.beer);
  const stout = clamp((P.beer - 0.6) / 0.4, 0, 1);
  const level = P.level;
  const hH = P.headH;
  const noise = P.noise;
  const t = P.T;
  // Foam coarsening: the mean cell grows from 2 LEDs, so fewer bubbles live.
  const cell = 2 * Math.pow(1 + P.foamAge * (0.5 + 1.5 * P.head), 0.5);
  const alive = clamp(4 / (cell * cell), 0.02, 1);
  const glint = 128 - ((P.t * 16) % 190);
  // The bubbles still alive in the head, in buckets of 4 by 4 LEDs. The dry
  // foam at the top coarsens first; the wet foam at the bottom stays fine.
  const { bStart, bItem, bOf } = P;
  bStart.fill(0);
  const topH = 1.1 / Math.max(6, hH);
  for (let q = 0; q < P.nf; q++) {
    const k = P.fu[q] * (0.45 + topH * P.fv[q]) <= alive ? Math.min(9, Math.floor(P.fv[q] / 4)) * 16 + Math.min(15, Math.floor(P.fx[q] / 4)) : -1;
    bOf[q] = k;
    if (k >= 0) bStart[k + 1]++;
  }
  for (let k = 0; k < 160; k++) bStart[k + 1] += bStart[k];
  const fill = bStart.slice(0, 160);
  for (let q = 0; q < P.nf; q++) if (bOf[q] >= 0) bItem[fill[bOf[q]]++] = q;
  // How many buckets out to look for the two nearest.
  const R = cell < 4.5 ? 1 : cell < 8 ? 2 : 3;
  const fx = P.fx;
  const fv = P.fv;
  const { hl, glx, bump, laces, wet: wetRows } = P;
  // A cheap generator for the sparkle of fine bubbles, reseeded each frame.
  let seed = (Math.random() * 4294967296) >>> 0;
  const sparkle = 0.0012 * P.fizz;
  const haze = 0.7 + (0.3 * (P.fizz - 4)) / 16;
  for (let y = 0; y < H; y++) {
    const hw = half(y);
    const inGlass = y >= RIM && y < FLOOR;
    const gy = Math.exp(-(((y - glint) / 4) ** 2));
    // Row by row: how cloudy the beer is, where the surge texture sits
    // going down the walls and up the middle, and how deep the row is.
    const cl = clamp((P.front - y) / 6 + 0.5, 0, 1);
    const sv = t * (6 + 6 * stout);
    const rowDown = ((((y - sv) % H) + H) % H | 0) * W;
    const rowUp = ((((y + sv) % H) + H) % H | 0) * W;
    const deep = 1 - (0.12 * (y - level)) / (FLOOR - RIM);
    const amp = (0.12 + 0.3 * stout) * cl;
    // More fizz, a thicker haze of fine bubbles.
    const hz = cl * haze;
    const cr = clear[0] + (cloudy[0] - clear[0]) * hz;
    const cg = clear[1] + (cloudy[1] - clear[1]) * hz;
    const cb = clear[2] + (cloudy[2] - clear[2]) * hz;
    const fine = sparkle * (1 - 0.6 * stout) * 4294967296;
    const wet = 0.12 * wetRows[y];
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      const dx = x + 0.5 - CX;
      let r = 9 + (3 * (H - y)) / H;
      let g = 7 + (2 * (H - y)) / H;
      let b = 6;
      if (y >= BAR) {
        // The bar top: dark wood with a sheen and the beer's reflection.
        const wood = 0.8 + 0.2 * Math.sin(x * 0.3 + y * 2.1 + Math.sin(x * 0.07) * 3);
        r = 52 * wood;
        g = 31 * wood;
        b = 18 * wood;
        if (y === BAR) {
          r += 40;
          g += 28;
          b += 18;
        }
        if (Math.abs(dx) < half(FLOOR) && level < FLOOR - 1) {
          const f = 0.22 * (1 - (y - BAR) / 5);
          r += clear[0] * f;
          g += clear[1] * f;
          b += clear[2] * f;
        }
      } else if (y >= FLOOR && Math.abs(dx) <= half(FLOOR) + 1) {
        // The thick glass foot, lit through by the beer above it.
        const lit = level < FLOOR - 1 ? 0.5 : 0.12;
        r = 26 + clear[0] * lit;
        g = 28 + clear[1] * lit;
        b = 32 + clear[2] * lit;
        if (y === BAR - 1 || Math.abs(dx) > half(FLOOR)) {
          r += 50;
          g += 52;
          b += 56;
        }
      } else if (inGlass && Math.abs(dx) <= hw) {
        const e = Math.abs(dx) / hw;
        const topV = hH + bump[x] * Math.min(1, hH / 4);
        if (y >= level) {
          // The beer: cloudy above the clearing front, clear below it, and
          // a surge in the haze: down along the walls, up the middle.
          const n = noise[(e > 0.62 ? rowDown : rowUp) + x] - 0.5;
          const m = (0.84 + 0.16 * (1 - e * e)) * deep * (1 + n * amp);
          r = cr * m;
          g = cg * m;
          b = cb * m;
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          if (seed < fine) {
            r += 70;
            g += 70;
            b += 60;
          }
        } else if (level - y <= topV) {
          // The head: Voronoi cells round the living bubbles, with bright
          // Plateau borders between them.
          const v = level - y;
          const bi = Math.min(9, Math.floor(v / 4));
          const bj = x >> 2;
          let d1 = 1e9;
          let d2 = 1e9;
          let a = -1;
          let c = -1;
          for (let jj = Math.max(0, bi - R); jj <= Math.min(9, bi + R); jj++)
            for (let ii = Math.max(0, bj - R); ii <= Math.min(15, bj + R); ii++)
              for (let qi = bStart[jj * 16 + ii], qe = bStart[jj * 16 + ii + 1]; qi < qe; qi++) {
                const q = bItem[qi];
                const ex = fx[q] - x - 0.5;
                const ev = fv[q] - v;
                const d = ex * ex + ev * ev;
                if (d < d1) {
                  d2 = d1;
                  c = a;
                  d1 = d;
                  a = q;
                } else if (d < d2) {
                  d2 = d;
                  c = q;
                }
              }
          let m = 0.62;
          if (c >= 0) {
            const sep = Math.sqrt((fx[a] - fx[c]) ** 2 + (fv[a] - fv[c]) ** 2);
            const edge = (d2 - d1) / (2 * sep);
            // A Plateau border, then the film of the cell, darker toward its middle.
            m = edge < 0.6 ? 1.06 : 0.9 - 0.24 * Math.min(1, (edge - 0.6) / Math.max(1, sep * 0.4));
          }
          // Wet foam at the bottom takes the beer's colour; the crown is lit.
          const wetF = clamp(1 - v / 2.5, 0, 1) * 0.5;
          const crown = topV - v < 1.2 ? 0.12 : 0;
          r = (head[0] * (1 - wetF) + clear[0] * wetF) * (m + crown);
          g = (head[1] * (1 - wetF) + clear[1] * wetF) * (m + crown);
          b = (head[2] * (1 - wetF) + clear[2] * wetF) * (m + crown);
        } else {
          // Empty glass: the bar behind, a film where beer has just run down,
          // and the lacing rings each sip left.
          r = 12 + clear[0] * wet;
          g = 11 + clear[1] * wet;
          b = 11 + clear[2] * wet;
          for (const l of laces) {
            const dy = y - l.y;
            if (dy < -1 || dy > 5) continue;
            const hsh = Math.sin(x * 12.9898 + l.k * 78.233 + Math.floor(dy) * 37.7) * 43758.5;
            const q = hsh - Math.floor(hsh);
            const lace = dy < 2 ? (q > 0.35 ? 0.55 : 0.2) : q > 0.86 + dy * 0.02 ? 0.4 : 0;
            r += head[0] * lace;
            g += head[1] * lace;
            b += head[2] * lace;
          }
        }
        // The bar lights' reflection runs down the left of the glass, with a
        // glint that climbs it, and a fainter one on the right.
        const s = hl[p] + glx[p] * gy;
        r += s;
        g += s;
        b += s;
      } else if (inGlass && Math.abs(dx) <= hw + 1.2) {
        // The glass wall seen edge on.
        r = 40;
        g = 44;
        b = 50;
      }
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  // Rising bubbles, bright in clear beer and lost in the haze.
  for (let i = 0; i < P.nb; i++) {
    const x = Math.round(P.bx[i] - 0.5);
    const y = Math.round(P.by[i]);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const cl = clamp((P.front - y) / 6 + 0.5, 0, 1);
    const v = (1 - 0.45 * cl) * (1 - 0.8 * stout) * (0.55 + Math.min(0.45, (FLOOR - y) / 120));
    const p = y * W + x;
    add(buf, p, 170 * v, 160 * v, 130 * v);
    if (x + 1 < W) add(buf, p + 1, 110 * v, 100 * v, 80 * v);
    if (FLOOR - y > 40 && y + 1 < H) add(buf, p + W, 60 * v, 56 * v, 44 * v);
  }
  // The rim, seen from just below: a flat ellipse, its near half brighter.
  for (let a = 0; a < 6.283; a += 0.03) {
    const s = Math.sin(a);
    const x = Math.round(CX - 0.5 + 27 * Math.cos(a));
    const y = Math.round(RIM - 0.5 + 1.6 * s);
    if (x < 0 || x >= W) continue;
    const v = s > 0 ? 90 : 45;
    const gl = glint < RIM + 6 && glint > RIM - 20 && Math.cos(a) < -0.6 ? 120 : 0;
    add(buf, y * W + x, v + gl, v + gl, v + 8 + gl);
  }
  // The stream from the tap, a little wavering, while the tap is open and as its tail falls.
  const sTop = P.mode === POUR ? 11 : P.streamTop;
  const sBot = level - hH;
  if (sTop < sBot) {
    const sx = Math.round(CX - 1 + 0.6 * Math.sin(P.t * 7));
    for (let y = Math.max(11, Math.floor(sTop)); y < sBot && y < FLOOR; y++)
      for (let i = -1; i <= 2; i++) {
        const x = sx + i;
        const core = i === 0 || i === 1;
        const f = core ? 1 : 0.4;
        const p = y * W + x;
        buf[p * 3] = buf[p * 3] * (1 - f) + (clear[0] * 1.05 + 30) * f;
        buf[p * 3 + 1] = buf[p * 3 + 1] * (1 - f) + (clear[1] * 1.05 + 30) * f;
        buf[p * 3 + 2] = buf[p * 3 + 2] * (1 - f) + (clear[2] * 1.05 + 26) * f;
        if (i === 0 && (y + Math.floor(P.t * 30)) % 7 < 2) add(buf, p, 60, 60, 60);
      }
  }
  // The tap from the front: a dark handle carrying a badge in the beer's
  // colour, the chrome body, and the spout over the rim.
  const put = (x, y, c0, c1, c2) => {
    const p = y * W + x;
    buf[p * 3] = c0;
    buf[p * 3 + 1] = c1;
    buf[p * 3 + 2] = c2;
  };
  for (let y = 0; y < 5; y++)
    for (let x = 28; x <= 35; x++) {
      const edge = x === 28 || x === 35;
      if (y >= 1 && y <= 3 && !edge && x > 29 && x < 34) put(x, y, clear[0] * 0.9 + 20, clear[1] * 0.9 + 20, clear[2] * 0.9 + 20);
      else put(x, y, x === 28 ? 96 : edge ? 22 : 52, x === 28 ? 90 : edge ? 20 : 46, x === 28 ? 86 : edge ? 19 : 42);
    }
  for (let y = 5; y < 11; y++) {
    const body = y <= 7;
    const x0 = body ? 24 : 29;
    const x1 = body ? 39 : 34;
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const v = (body ? 70 + 40 * (7 - y) : 60) + 150 * Math.exp(-(((u - 0.32) / 0.14) ** 2)) + (u > 0.85 || u < 0.08 ? -30 : 0);
      put(x, y, v * 0.92, v * 0.95, v);
    }
  }
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, (p / W) | 0, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
  }
}
