// ===== Patternflow pattern =====
// Title:   Ship Tracks
// Family:  shiptrack
// Idea:    A satellite looks straight down on marine stratocumulus over a near-black navy ocean, a honeycomb of soft bright cells torn open here and there into rings and clear water, and ships cross it on straight courses at every heading, each leaving a line of brighter cloud that is born 2 LED wide behind the ship, widens as the square root of its age, fades slowly and drifts off with the deck while the wind shear turns and bows it, bright over the deck and barely there over clear water.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ship tracks in satellite pictures of marine stratocumulus (Conover, 1966); the brightening of a cloud by more and smaller droplets of the same water (Sean Twomey, 1974 and 1977); the Monterey Area Ship Track experiment (Durkee and co-workers, 2000); closed and open cells of the deck (Agee, 1984; Wood and Hartmann, 2006), all from memory. Original here: a drifting additively weighted Voronoi deck whose cells swell and die one by one, and tracks as polylines that age, widen and are carried and sheared by the wind, multiplied into the cloud, pattern round 260
// Round:   260
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=1..4, Cells=-1..1, Traffic=-1..1
//
// Knob 1: Hue. Four looks and back: at 0 the natural one, grey and white cloud on near-black navy water with a faint sunglint at the upper right; at 0.25 a cool blue-violet false colour; at 0.5 a warm low sun, peach cloud on plum water; at 0.75 a green-cyan band look, mint on deep teal; at 1 natural again.
// Knob 2: Wind. 1 to 4, opening at 2, where it is calm: the deck drifts 0.75 LED a second and a ship makes 3.2. Everything runs at (Wind / 2) to the power 0.8, the ships, the ageing of the tracks and the life of the cells, and the deck's drift grows by a further (Wind / 2) to the power 0.6. At 1 the deck creeps at 0.28 and a ship at 1.8, so a track lies close along its course; at 4 the deck runs at 2 and the ships at 5.6, and old tracks are carried far from the courses that laid them.
// Knob 3: Cells. -1 to 1, opening at 0. A cloud cell is 10 LED across at the opening and 1.6 times larger for each unit: a fine honeycomb of 6 LED cells at -1, about ten across the panel, and big 16 LED cells at 1, four across. The view zooms about the middle of the panel; the tracks and the clear water keep their size.
// Knob 4: Traffic. -1 to 1, opening at 0.06. How many ships there are and how strongly their tracks brighten the cloud. Each ship gets a rank as it comes on and the knob shows the tracks ranked under its share, 23 percent at -1, half at the opening and all at 1, while the schedule leans toward 460, 1000 and 2000 LED^2 of track on the panel: one or two tracks in sight, two to four, five to eight. The brightening goes from 0.68 to 1 of full strength.

// What the picture is. The deck is a lattice of cells in rows 0.866 apart, each offset half a cell, so the cells start as hexagons. Each
// centre wanders 0.2 cell, and each cell carries a weight w that swells and shrinks over 2.5 to 8 minutes. A pixel belongs to the cell
// with the least d - w, an additively weighted Voronoi diagram, so a cell with a low weight is squeezed by its neighbours until it vanishes,
// and comes back later. Half of F2 - F1 is the distance to the rim: a closed cell is a dome that falls to 47 percent in a lane about 3 LED
// wide, an open cell is the reverse, a wall 3 to 4 LED wide round clear water. The lattice drifts with the wind.
// Coverage is two octaves of value noise, 46 and 20 LED across and changing in time, sampled every 2 LED and read half at the pixel and
// half at the two nearest cell centres, so the edge of the deck runs along cell rims. Its threshold keeps 70 percent of the panel closed,
// followed over 25 s, with a slow correction from the share of cloud each frame measures.
// A ship enters a field 80 LED round the panel on a straight course through a random point of the panel, at any heading but the near
// horizontal, and drops an emission point every 3 LED. Each point is carried by the wind: the deck's drift, a slow rotation and strain
// about the middle of the panel and a long gentle wave, so an old track turns up to about 30 degrees and bows a few LED. The wind swings
// up to 80 degrees either way over periods of 19 and 46 minutes. Points older than 18 s merge while the gap stays under 6.5 LED, and a
// track dies at 130 model seconds. Ships come every 16 s, and the schedule leans on how much track the panel holds.
// Drawing. Between two points a track is a band of half width 1 + 0.27 sqrt(age) LED, 2 LED across at birth and 7.4 at 100 s, flat on
// top with a smoothstep edge 0.95 LED either side at birth and 1.8 at 100 s. Its height rises over 1.6 s, falls toward 70 percent and
// fades over the last 35 s, and its first and last 28 LED fade in and out. Each pixel keeps the brightest track T. Inside a track the
// lanes of the deck fill most of the way up and the brightness p 0.54 becomes p (0.54 + 0.8 T), so a track is a white band over the deck,
// a lighter run of rings over open cells and only a faint thin line, its young part, over clear water. Brightness runs through five
// tones: the water lifted toward the sunglint, the lane grey, the deck and the white of a track.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, sin, cos, min, max, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// ---- the model
const RH = 0.8660254;              // row spacing of the cell lattice, in cells
const WMAX = 0.27;                 // the largest weight of a cell
const G0 = 10, G_BASE = 1.6;       // LED across a cell at the opening, and the factor for each unit of Cells
const MARG = 80;                   // ships and tracks live in the panel and this margin round it
const DX0 = -MARG, DX1 = W + MARG, DY0 = -MARG, DY1 = H + MARG;
const SHIP_V = 3.2;                // LED a model second
const STEP = 3, STEP_OLD = 6.5;    // LED of course between two emission points, and between two old ones after merging
const LIFE = 130;                  // model seconds a track lives
const HW0 = 1, HWK = 0.27;         // the half width of a track, HW0 + HWK sqrt(age) LED, and its soft edge is 0.95 + 0.3125 (hw - 1) either side
const NMAX = 5;                    // ships on the field at full traffic
const CROSS = 80;                  // model seconds a ship takes to cross the field, on average
const AREA0 = 2000;                // LED^2 of track on the panel at full share, which the schedule leans toward
const WIND0 = 0.75;                // LED a model second the deck drifts at the opening
const LC1 = 46, LC2 = 20;          // LED across the two octaves of coverage
const COVER = 0.7;                 // the share of closed deck the threshold keeps on the panel
const CGS = 2, CGX = 33, CGY = 65; // the coverage grid, one sample every 2 LED

function hsh(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Value noise in two dimensions and time, -1..1, smooth in all three.
function vn3(x, y, z, salt) {
  const x0 = floor(x), y0 = floor(y), z0 = floor(z);
  let fx = x - x0, fy = y - y0, fz = z - z0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const s0 = salt + z0 * 7919, s1 = s0 + 7919;
  const a0 = hsh(x0, y0, s0), b0 = hsh(x0 + 1, y0, s0), c0 = hsh(x0, y0 + 1, s0), d0 = hsh(x0 + 1, y0 + 1, s0);
  const a1 = hsh(x0, y0, s1), b1 = hsh(x0 + 1, y0, s1), c1 = hsh(x0, y0 + 1, s1), d1 = hsh(x0 + 1, y0 + 1, s1);
  const p0 = a0 + (b0 - a0) * fx, q0 = c0 + (d0 - c0) * fx, p1 = a1 + (b1 - a1) * fx, q1 = c1 + (d1 - c1) * fx;
  const v0 = p0 + (q0 - p0) * fy, v1 = p1 + (q1 - p1) * fy;
  return (v0 + (v1 - v0) * fz) * 2 - 1;
}

function makeState() {
  return {
    ready: false, salt: floor(rnd() * 1e6), tau: 0,
    kn: [0, 2, 0, 0.06], wind: 2, G: G0, traffic: 0,
    th0: rnd() * 6.28, th1: rnd() * 6.28, wd: rnd() * 6.28,
    ux: 0, uy: 0, om: 0, e1: 0, e2: 0, ph1: rnd() * 6.28, ph2: rnd() * 6.28,
    dx: 0, dy: 0, cx: rnd() * 100, cy: rnd() * 100,
    cov: new Float32Array(CGX * CGY), cth: 0, cthSet: false, cbias: 0, meas: -1, gacc: 0, gdx: 0, gdy: 0, frame: 0, area: 0,
    gxi: new Int16Array(W), gxf: new Float32Array(W),
    icE: new Int32Array(W), icO: new Int32Array(W), frE: new Float32Array(W), frO: new Float32Array(W), cand: new Int32Array(10), srt: new Float32Array(CGX * CGY),
    tracks: [], spawnT: 0, rank: rnd(),
    T: new Float32Array(NPX), TN: new Float32Array(NPX),
    cpx: new Float32Array(1200), cpy: new Float32Array(1200), cpw: new Float32Array(1200), cpb: new Float32Array(1200), cpc: new Float32Array(1200),
    glint: null, pal: new Float32Array(15), palAt: -1,
  };
}

export function setup(params) {
  const S = makeState();
  const g = new Float32Array(NPX);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ax = (x - 54) / 34, ay = (y - 18) / 58;
      g[y * W + x] = exp(-(ax * ax + ay * ay)) * 0.85 + 0.15 * (1 - y / H);
    }
  S.glint = g;
  params.s = S;
}

const knobsOf = (input) => {
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  return [cl(kn[0], 0, 1), cl(kn[1], 1, 4), cl(kn[2], -1, 1), cl(kn[3], -1, 1)];
};

// The wind at model time tau, its shear and its slow wave.
function windAt(S) {
  const t = S.tau, k = S.wind / 2;
  const ang = S.wd + 0.9 * sin(0.0055 * t + S.th0) + 0.5 * sin(0.0023 * t + S.th1);
  const ws = WIND0 * pow(k, 0.6);
  S.ux = ws * cos(ang);
  S.uy = ws * sin(ang);
  S.om = 0.0026 * sin(0.0121 * t + 1.1) + 0.0014 * sin(0.0057 * t + S.th1);
  S.e1 = 0.0022 * sin(0.0093 * t + 0.4 + S.th0);
  S.e2 = 0.0018 * sin(0.0071 * t + 2.6);
  S.ph1 = 0.021 * t + S.th0;
  S.ph2 = 0.017 * t + S.th1;
}

function coverageGrid(S) {
  const cov = S.cov, z1 = S.tau / 70, z2 = S.tau / 37 + 5;
  // the octaves are turned so the noise lattice never lines up with the LEDs
  const c1 = 0.857 / LC1, s1 = 0.515 / LC1, c2 = 0.697 / LC2, s2 = -0.717 / LC2;
  for (let j = 0; j < CGY; j++)
    for (let i = 0; i < CGX; i++) {
      const wx = i * CGS - S.dx, wy = j * CGS - S.dy;
      cov[j * CGX + i] =
        0.64 * vn3(wx * c1 - wy * s1, wx * s1 + wy * c1, z1, S.salt) + 0.36 * vn3(wx * c2 - wy * s2 + 31.7, wx * s2 + wy * c2 + 12.3, z2, S.salt + 3);
    }
  S.gdx = S.dx;
  S.gdy = S.dy;
  // the threshold that leaves COVER of the panel closed, followed slowly
  S.srt.set(cov);
  S.srt.sort();
  return S.srt[floor((1 - COVER) * (CGX * CGY - 1))];
}

function spawnShip(S) {
  let th = 0, c = 1, s = 0;
  for (let k = 0; k < 20; k++) {
    th = rnd() * 2 * PI;
    c = cos(th);
    s = sin(th);
    if (Math.abs(s) > 0.42) break;
  }
  const px = 8 + 48 * rnd(), py = 14 + 100 * rnd();
  // back along the course to the edge of the field
  let tb = 1e9;
  if (c > 1e-6) tb = min(tb, (px - DX0) / c);
  if (c < -1e-6) tb = min(tb, (px - DX1) / c);
  if (s > 1e-6) tb = min(tb, (py - DY0) / s);
  if (s < -1e-6) tb = min(tb, (py - DY1) / s);
  const sx = px - c * (tb - 0.5), sy = py - s * (tb - 0.5), v = SHIP_V * (0.85 + 0.3 * rnd());
  S.rank = (S.rank + 0.6180339887) % 1;
  S.tracks.push({
    sx, sy, vx: c * v, vy: s * v, live: true,
    xs: [sx], ys: [sy], ts: [S.tau],
    rank: S.rank, wf: 0.85 + 0.3 * rnd(), sf: 0.85 + 0.15 * rnd(),
  });
}

function stepTracks(S, dtm, measure) {
  const ux = S.ux, uy = S.uy, om = S.om, e1 = S.e1, e2 = S.e2, ph1 = S.ph1, ph2 = S.ph2, tau = S.tau;
  const bm = 0.07 * pow(S.wind / 2, 0.6), share = shareOf(S);
  const out = [];
  let area = 0;
  for (const tr of S.tracks) {
    const xs = tr.xs, ys = tr.ys, ts = tr.ts, n = xs.length;
    for (let i = 0; i < n; i++) {
      const x = xs[i], y = ys[i], ddx = x - 32, ddy = y - 64;
      const vx = ux - om * ddy + e1 * ddx + e2 * ddy + bm * sin(0.052 * y + 0.021 * x + ph1);
      const vy = uy + om * ddx + e2 * ddx - e1 * ddy + bm * 0.7 * cos(0.047 * x - 0.019 * y + ph2);
      xs[i] = x + vx * dtm;
      ys[i] = y + vy * dtm;
    }
    if (tr.live) {
      tr.sx += tr.vx * dtm;
      tr.sy += tr.vy * dtm;
      const inside = tr.sx > DX0 && tr.sx < DX1 && tr.sy > DY0 && tr.sy < DY1;
      const lx = xs[xs.length - 1], ly = ys[ys.length - 1];
      const gap = (tr.sx - lx) ** 2 + (tr.sy - ly) ** 2;
      if (!inside || gap >= STEP * STEP) {
        xs.push(tr.sx);
        ys.push(tr.sy);
        ts.push(tau);
      }
      if (!inside) tr.live = false;
    }
    // drop the dead tail
    let k = 0;
    while (k < ts.length && tau - ts[k] > LIFE) k++;
    if (k > 0) {
      xs.splice(0, k);
      ys.splice(0, k);
      ts.splice(0, k);
    }
    // merge old points whose neighbours stay close
    if (xs.length > 3) {
      let w = 1;
      for (let i = 1; i < xs.length - 1; i++) {
        const age = tau - ts[i];
        if (age > 18) {
          const gx = xs[i + 1] - xs[w - 1], gy = ys[i + 1] - ys[w - 1];
          if (gx * gx + gy * gy < STEP_OLD * STEP_OLD) continue;
        }
        xs[w] = xs[i];
        ys[w] = ys[i];
        ts[w] = ts[i];
        w++;
      }
      xs[w] = xs[xs.length - 1];
      ys[w] = ys[ys.length - 1];
      ts[w] = ts[ts.length - 1];
      w++;
      xs.length = w;
      ys.length = w;
      ts.length = w;
    }
    if (tr.live || xs.length >= 2) {
      // a dead ship's track that has drifted wholly off the field goes too
      if (!tr.live) {
        let anyIn = false;
        for (let i = 0; i < xs.length; i++)
          if (xs[i] > DX0 - 10 && xs[i] < DX1 + 10 && ys[i] > DY0 - 10 && ys[i] < DY1 + 10) {
            anyIn = true;
            break;
          }
        if (!anyIn) continue;
      }
      out.push(tr);
      const vis = sm(tr.rank - 0.05, tr.rank + 0.05, share);
      if (measure && vis > 0.01)
        for (let i = 1; i < xs.length; i++) {
          const mx = 0.5 * (xs[i] + xs[i - 1]), my = 0.5 * (ys[i] + ys[i - 1]);
          if (mx < 0 || mx > W || my < 0 || my > H) continue;
          const a = tau - ts[i];
          area += sqrt((xs[i] - xs[i - 1]) ** 2 + (ys[i] - ys[i - 1]) ** 2) * 2 * half(a, tr.wf) * hgt(a) * vis;
        }
    }
  }
  S.tracks = out;
  if (measure) S.area = area;
}

function advance(S, dtm, grid) {
  S.tau += dtm;
  windAt(S);
  S.dx += S.ux * dtm;
  S.dy += S.uy * dtm;
  S.cx += (S.ux * dtm) / S.G;
  S.cy += (S.uy * dtm) / S.G;
  S.gacc += dtm;
  if (grid) {
    const want = coverageGrid(S);
    if (!S.cthSet) {
      S.cth = want;
      S.cthSet = true;
    } else S.cth += (want - S.cth) * (1 - exp(-S.gacc / 25));
    S.gacc = 0;
  }
  // and the share of cloud measured on the last frame pulls the threshold the rest of the way
  if (S.meas >= 0) {
    S.cbias = cl(S.cbias + (S.meas - COVER) * dtm * 0.05, -0.4, 0.4);
    S.meas = -1;
  }
  // the schedule leans on how much track the panel holds
  const want = AREA0 * shareOf(S);
  S.spawnT -= dtm * cl(pow(want / max(S.area, 1), 1.2), 0.3, 3);
  while (S.spawnT <= 0) {
    spawnShip(S);
    S.spawnT += (CROSS / NMAX) * (0.7 + 0.6 * rnd());
  }
  stepTracks(S, dtm, grid);
}

const tempoOf = (wind) => pow(wind / 2, 0.8);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = knobsOf(input), d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.wind = kn[1];
    S.G = G0 * pow(G_BASE, kn[2]);
    S.traffic = kn[3];
    // run the sea for 200 model seconds so the panel opens with tracks of every age on it
    for (let k = 0; k < 200; k++) advance(S, 1, k % 5 === 4);
    S.frame = 0;
    coverageGrid(S);
  }
  const kf = 1 - exp(-d / 0.3);
  S.wind += (kn[1] - S.wind) * kf;
  S.G += (G0 * pow(G_BASE, kn[2]) - S.G) * kf;
  S.traffic += (kn[3] - S.traffic) * kf;
  // the coverage moves slowly and is sampled every fourth frame, shifted with the deck in between
  advance(S, d * tempoOf(S.wind), (S.frame++ & 3) === 0);
}

// ---- colour: water, sunglint, rim grey, deck, track white for each of four looks
const KEYS = [
  [[4, 9, 27], [24, 42, 72], [66, 76, 98], [174, 182, 198], [250, 252, 255]],
  [[9, 6, 34], [42, 26, 90], [70, 58, 138], [146, 136, 224], [238, 232, 255]],
  [[16, 10, 32], [86, 50, 64], [118, 84, 96], [224, 184, 158], [255, 240, 222]],
  [[2, 15, 24], [8, 52, 58], [24, 88, 90], [92, 192, 172], [224, 255, 240]],
];
function paletteAt(S, hue) {
  if (S.palAt === hue) return;
  const p = hue * 4, i = floor(p) % 4, u = sm(0, 1, p - floor(p)), a = KEYS[i], b = KEYS[(i + 1) % 4];
  for (let k = 0; k < 5; k++) for (let c = 0; c < 3; c++) S.pal[k * 3 + c] = a[k][c] + (b[k][c] - a[k][c]) * u;
  S.palAt = hue;
}

// ---- the tracks into T (brightening) and TN (the young thin part, for clear water)
function segment(T, TN, ax, ay, sa, ma, ya, bx, by, sb, mb, yb) {
  const R = 1.3125 * (sa > sb ? sa : sb) + 0.6375 + 0.5;
  const x0 = max(0, floor(min(ax, bx) - R)), x1 = min(W - 1, ceil(max(ax, bx) + R));
  const y0 = max(0, floor(min(ay, by) - R)), y1 = min(H - 1, ceil(max(ay, by) + R));
  if (x0 > x1 || y0 > y1) return;
  const dX = bx - ax, dY = by - ay, L2 = dX * dX + dY * dY, inv = L2 > 1e-6 ? 1 / L2 : 0;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - ay;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax;
      let t = (px * dX + py * dY) * inv;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = px - t * dX, qy = py - t * dY, hw = sa + (sb - sa) * t, soft = 0.6375 + 0.3125 * hw;
      const d2 = qx * qx + qy * qy, out = hw + soft;
      if (d2 >= out * out) continue;
      // a flat top and a soft edge: 1 inside hw - soft, 0.5 at hw, 0 at hw + soft
      let g = (out - sqrt(d2)) / (2 * soft);
      if (g > 1) g = 1;
      g = g * g * (3 - 2 * g);
      const v = (ma + (mb - ma) * t) * g, p = y * W + x;
      if (v > T[p]) T[p] = v;
      const vy = v * (ya + (yb - ya) * t);
      if (vy > TN[p]) TN[p] = vy;
    }
  }
}

const half = (a, wf) => (HW0 + HWK * sqrt(a)) * wf;
const hgt = (a) => sm(0, 1.6, a) * (0.7 + 0.3 * exp(-a / 50)) * (1 - sm(LIFE - 35, LIFE, a));
const shareOf = (S) => (2.4 * pow(2.1, S.traffic)) / NMAX;

function drawTracks(S) {
  const T = S.T, TN = S.TN, tau = S.tau;
  T.fill(0);
  TN.fill(0);
  const share = shareOf(S), str = 0.84 + 0.16 * S.traffic;
  for (const tr of S.tracks) {
    const vis = sm(tr.rank - 0.05, tr.rank + 0.05, share);
    if (vis < 0.01) continue;
    const xs = tr.xs, ys = tr.ys, ts = tr.ts, n = xs.length, amp = vis * str * tr.sf, wf = tr.wf;
    let pa = tau - ts[0], px = xs[0], py = ys[0];
    // the first 28 LED fade in, and the last 28 once the ship has gone, so an end that drifts onto the panel is not blunt
    const m = tr.live ? n + 1 : n;
    let len = 0;
    for (let i = 1; i < n; i++) len += sqrt((xs[i] - xs[i - 1]) ** 2 + (ys[i] - ys[i - 1]) ** 2);
    let psg = half(pa, wf), pm = 0, pyo = exp(-pa / 10), arc = 0;
    for (let i = 1; i < m; i++) {
      const head = i === n;
      const a = head ? 0 : tau - ts[i], x = head ? tr.sx : xs[i], y = head ? tr.sy : ys[i];
      arc += sqrt((x - px) * (x - px) + (y - py) * (y - py));
      const sg = half(a, wf), mm = amp * hgt(a) * sm(0, 28, arc) * (tr.live ? 1 : sm(0, 28, len - arc)), yo = exp(-a / 10);
      if (pm > 0.004 || mm > 0.004) segment(T, TN, px, py, psg, pm, pyo, x, y, sg, mm, yo);
      px = x;
      py = y;
      psg = sg;
      pm = mm;
      pyo = yo;
    }
  }
}

// ---- the cells of this frame
function cellTable(S) {
  const G = S.G, tau = S.tau, salt = S.salt;
  const umin = (0.5 - 32) / G - S.cx, umax = (W - 0.5 - 32) / G - S.cx;
  const vmin = (0.5 - 64) / G - S.cy, vmax = (H - 0.5 - 64) / G - S.cy;
  const jmin = floor(vmin / RH) - 2, jmax = floor(vmax / RH) + 3;
  const imin = floor(umin) - 2, imax = floor(umax) + 3;
  const nc = imax - imin + 1;
  const cpx = S.cpx, cpy = S.cpy, cpw = S.cpw, cpb = S.cpb, cpc = S.cpc, cov = S.cov, ddx = S.dx - S.gdx, ddy = S.dy - S.gdy;
  for (let j = jmin; j <= jmax; j++)
    for (let i = imin; i <= imax; i++) {
      const k = (j - jmin) * nc + (i - imin);
      const h1 = hsh(i, j, salt + 1), h2 = hsh(i, j, salt + 2), h3 = hsh(i, j, salt + 3), h4 = hsh(i, j, salt + 4);
      const h5 = hsh(i, j, salt + 5);
      cpx[k] = i + 0.5 * (j & 1) + 0.2 * sin((0.018 + 0.03 * h1) * tau + 6.283 * h2);
      cpy[k] = j * RH + 0.2 * sin((0.018 + 0.03 * h2) * tau + 6.283 * h1);
      cpw[k] = 0.27 * sin((0.013 + 0.03 * h3) * tau + 6.283 * h4);
      cpb[k] = 0.76 + 0.24 * h5;
      // the coverage at the cell's centre
      const gx = cl(((cpx[k] + S.cx) * G + 31.5 - ddx) / CGS, 0, CGX - 1.001), gy = cl(((cpy[k] + S.cy) * G + 63.5 - ddy) / CGS, 0, CGY - 1.001);
      const gi = floor(gx), gj = floor(gy), fx = gx - gi, fy = gy - gj, q = gj * CGX + gi;
      const c0 = cov[q] + (cov[q + 1] - cov[q]) * fx, c1 = cov[q + CGX] + (cov[q + CGX + 1] - cov[q + CGX]) * fx;
      cpc[k] = c0 + (c1 - c0) * fy;
    }
  return { imin, jmin, nc };
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  paletteAt(S, S.kn[0]);
  drawTracks(S);
  const P = S.pal, G = S.G, T = S.T, TN = S.TN, cov = S.cov, cth = S.cth + S.cbias, gl = S.glint;
  let cloud = 0;
  const { imin, jmin, nc } = cellTable(S);
  const cpx = S.cpx, cpy = S.cpy, cpw = S.cpw, cpb = S.cpb, cpc = S.cpc;
  const iG = 1 / G, domeW = 0.48 * G, gxi = S.gxi, gxf = S.gxf;
  for (let x = 0; x < W; x++) {
    const gx = cl((x - S.dx + S.gdx) / CGS, 0, CGX - 1.001), gi = floor(gx);
    gxi[x] = gi;
    gxf[x] = gx - gi;
  }
  // for each column, the lattice column left of it in an even row and in an odd row, and how far past it
  const icE = S.icE, icO = S.icO, frE = S.frE, frO = S.frO, cand = S.cand;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - 32) * iG - S.cx, a = floor(u), b = floor(u - 0.5);
    icE[x] = a;
    frE[x] = u - a;
    icO[x] = b;
    frO[x] = u - 0.5 - b;
  }
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5 - 64) * iG - S.cy;
    const j0 = floor(v / RH), p0 = j0 & 1;
    const rA = (j0 - jmin) * nc - imin, rB = rA + nc, rC = rA - nc, rD = rA + 2 * nc;
    const gy = cl((y - S.dy + S.gdy) / CGS, 0, CGY - 1.001), gj = floor(gy), fy = gy - gj;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - 32) * iG - S.cx;
      // the rows either side of the pixel: three columns in the two near ones and two in the far ones, nearest first
      const i0 = p0 ? icO[x] : icE[x], f0 = p0 ? frO[x] : frE[x], i1 = p0 ? icE[x] : icO[x], f1 = p0 ? frE[x] : frO[x];
      cand[0] = rA + i0;
      cand[1] = rA + i0 + 1;
      cand[2] = rB + i1;
      cand[3] = rB + i1 + 1;
      cand[4] = rA + (f0 < 0.5 ? i0 - 1 : i0 + 2);
      cand[5] = rB + (f1 < 0.5 ? i1 - 1 : i1 + 2);
      cand[6] = rC + i1;
      cand[7] = rC + i1 + 1;
      cand[8] = rD + i0;
      cand[9] = rD + i0 + 1;
      let F1 = 1e9, F2 = 1e9, k1 = 0, k2 = 0;
      for (let q = 0; q < 10; q++) {
        // a centre farther than F2 plus the largest weight cannot come in
        const k = cand[q], ddx = u - cpx[k], ddy = v - cpy[k], d2 = ddx * ddx + ddy * ddy, lim = F2 + WMAX;
        if (d2 < lim * lim) {
          const dd = sqrt(d2) - cpw[k];
          if (dd < F1) {
            F2 = F1;
            k2 = k1;
            F1 = dd;
            k1 = k;
          } else if (dd < F2) {
            F2 = dd;
            k2 = k;
          }
        }
      }
      const eL = 0.5 * (F2 - F1) * G, cb = cpb[k1];
      // closed cell: a dome falling to its rim; open cell: a wall along the rim
      const dome = sm(-0.2, 3, eL) * (0.85 + 0.15 * sm(2, domeW, eL));
      const pc = (0.47 + 0.53 * dome) * cb;
      const pr = (1 - sm(0.5, 3, eL)) * 0.6 * cb;
      // coverage, bilinear on the 2 LED grid
      const gi = gxi[x], fx = gxf[x], q = gj * CGX + gi;
      const c0 = cov[q] + (cov[q + 1] - cov[q]) * fx, c1 = cov[q + CGX] + (cov[q + CGX + 1] - cov[q + CGX]) * fx;
      const cv = 0.5 * (c0 + (c1 - c0) * fy) + 0.5 * (cpc[k1] + (cpc[k2] - cpc[k1]) * 0.5 * (1 - sm(0, 2.2, eL)));
      const closed = sm(cth - 0.05, cth + 0.13, cv), ring = sm(cth - 0.3, cth - 0.08, cv) * (1 - closed);
      const p = closed * pc + ring * pr;
      cloud += closed + 0.5 * ring;
      const pix = y * W + x, t = T[pix];
      // a track fills the rims of the cloud it crosses and lifts its brightness
      const full = (closed * 0.95 + ring * 0.55) * cb;
      const pt = full > p ? p + min(1, t * 1.1) * 0.8 * (full - p) : p;
      const A = pt * (0.54 + 0.8 * t) + 0.16 * TN[pix] * (1 - p);
      // five tones: water and glint, rim grey, deck, track white
      const g = gl[pix];
      let r = P[0] + (P[3] - P[0]) * g, gg = P[1] + (P[4] - P[1]) * g, b = P[2] + (P[5] - P[2]) * g;
      if (A < 0.2) {
        const f = A / 0.2;
        r += (P[6] - r) * f;
        gg += (P[7] - gg) * f;
        b += (P[8] - b) * f;
      } else if (A < 0.52) {
        const f = (A - 0.2) / 0.32;
        r = P[6] + (P[9] - P[6]) * f;
        gg = P[7] + (P[10] - P[7]) * f;
        b = P[8] + (P[11] - P[8]) * f;
      } else {
        const f = min(1, (A - 0.52) / 0.4);
        r = P[9] + (P[12] - P[9]) * f;
        gg = P[10] + (P[13] - P[10]) * f;
        b = P[11] + (P[14] - P[11]) * f;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
  S.meas = cloud / NPX;
}
