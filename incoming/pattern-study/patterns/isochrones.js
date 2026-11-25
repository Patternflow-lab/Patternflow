// ===== Patternflow pattern =====
// Title:   Isochrones
// Family:  isochrone
// Idea:    A travel-time map of an endless city drawn round a traveller who keeps walking: flat bands of equal travel time flow outward from a white point as spiky stars that reach far along the avenues, stop at a river except at its bridges and open again as islands round the metro stations, while the city scrolls underneath and reshapes them.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the isochrone map of transport planning (Francis Galton's isochronic passage chart, 1881, from memory); travel times by Dijkstra's algorithm (Edsger Dijkstra, 1959) on a 16-neighbour grid with Dial's bucket queue (Robert Dial, 1969, from memory); the hashed endless city, the bands that flow outward at the local travel speed with a shadow at each inner edge, and the walking traveller are original, pattern round 253
// Round:   253
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Grain=-1..1, Walk=0..1
//
// Knob 1: Hue. Turns the whole ramp round the wheel; it opens with yellow at the traveller, then orange, red and magenta, and violet at the far end. The water stays navy.
// Knob 2: Speed. 0.3 to 3, opening at 2. The walking pace and the outward flow together: the city scrolls at 1.75 LEDs a second at the bottom, 4.3 at the opening and 5.8 at the top.
// Knob 3: Grain. -1 to 1, opening at 0. The travel time one band spans: 11.8 at -1, four broad bands on the panel; 7 at 0, seven; 4.2 at 1, twelve, or eighteen with Walk at 1.
// Knob 4: Walk. 0 to 1, opening at 0.06. At 0 the city has all its speeds, avenues 2.5 to 7 times quicker than the blocks beside them and a metro, and the bands are spiky stars with islands round the stations; at 1 every road moves at one walking pace and the metro is shut, so the bands are round where the city is open and rounded diamonds where it is dense, still broken by the water.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, round, abs, ceil, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const TX = 32, TY = 76;                 // the traveller's LED
const MG = 16, PAD = 2;                 // cells solved beyond the panel on every side, and a ring of wall round them
const GW = W + 2 * MG + 2, GH = H + 2 * MG + 2;
const AW = GW + 2 * PAD, AH = GH + 2 * PAD, NN = AW * AH;
const NST = 12;                         // metro platforms carried by one solve
const BIG = 1e5, BIGH = 5e4, WALL = 1e6;
const NBK = 4096, NE = NN * 8;
const VW = W + 1, VH = H + 1;
const SOLVE = 1 / 15;                   // seconds between two solves

// slowness, in time per LED
const S_ART = 0.22, S_ST = 0.8, S_PARK = 0.7, S_WALK = 0.6, S_SWIM = 3;
const T_ART = 1, T_ST = 0.95, T_PARK = 0.95;   // how bright each ground is drawn
const PITCH = 34, JIT = 7;              // avenues: every 28 to 40 LEDs
const BPX = [7, 9, 13], BPY = [11, 9, 8];
const RIDE = 1 / 24, WAIT = 1.4, DWELL = 0.2;
const TREF = 38;                        // the travel time at which the ramp ends
const HUE0 = 0.15, SPAN = 0.42;
const NB = 96, LO = 0.36;

function hsh(a, b, s) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the city, in world cells -------------------------------------------------------
const artY = (j, s) => PITCH * j + floor(JIT * hsh(j, 11, s));
const artX = (i, j, s) => PITCH * i + floor(JIT * hsh(i, (j + (i & 1)) >> 1, s ^ 0x3a7));
const artOn = (i, j, s) => !(i & 1) || hsh(i, j, s ^ 0x5c1) > 0.2;
const crossR = (j, s) => j % 3 === 0 && hsh(j, 6, s ^ 0xc3) < 0.5;     // a tributary lies in this band
// the traveller's track, the river and the metro line all hang on one wandering column
const pathX = (st, y) => 44 * sin(0.0041 * y + st.ph[0]) + 21 * sin(0.0097 * y + st.ph[1]) + 6 * sin(0.0233 * y + st.ph[2]);
const rivOff = (st, y) => 34 * sin(0.0113 * y + st.ph[3]) + 20 * sin(0.0271 * y + st.ph[4]) + 8 * sin(0.0619 * y + st.ph[5]);
const riverX = (st, y) => pathX(st, y) + rivOff(st, y);
const ST = { x: 0, y: 0 };
function station(st, k) {
  const y = 46 * k + floor(10 * hsh(k, 1, st.seed ^ 0x9e1));
  let x = round(pathX(st, y) + 17 * (2 * hsh(k, 2, st.seed ^ 0x9e2) - 1));
  const xr = riverX(st, y);
  if (abs(x - xr) < 9) x = round(xr + (x >= xr ? 9 : -9));
  ST.x = x; ST.y = y;
  return ST;
}

const EDGE = new Float32Array(NN).fill(1);   // the rim of the solved window is slowed, so a road entering it does not pop
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
  const d = min(x, y, GW - 1 - x, GH - 1 - y), u = 1 - min(d, 8) / 8;
  EDGE[(y + PAD) * AW + x + PAD] = 1 + 2 * u * u;
}

function raster(st, ox, oy) {
  const s = st.seed, cls = st.cls, slb = st.slb, txb = st.txb, wat = st.wat, br = st.bridge;
  st.ox = ox; st.oy = oy;
  wat.fill(0); br.fill(0); st.nl = 0;
  const fillR = (x0, y0, x1, y1, c, sv, tv) => {
    x0 = max(x0 - ox, 0); x1 = min(x1 - ox, GW); y0 = max(y0 - oy, 0); y1 = min(y1 - oy, GH);
    for (let y = y0; y < y1; y++) {
      const r = (y + PAD) * AW + PAD;
      for (let x = x0; x < x1; x++) { cls[r + x] = c; slb[r + x] = sv; txb[r + x] = tv; }
    }
  };
  let j = floor(oy / PITCH) - 1;
  while (artY(j + 1, s) <= oy) j++;
  for (; ; j++) {
    const y0 = artY(j, s);
    if (y0 >= oy + GH) break;
    const y1 = artY(j + 1, s);
    let i = (floor(ox / PITCH) - 2) & ~1;
    let xa = artX(i, j, s), ia = i;
    for (i++; ; i++) {
      if (!artOn(i, j, s)) continue;
      const xb = artX(i, j, s);
      if (xb > ox) {
        // the blocks between two avenues: one size to a district, the streets spread evenly
        const x0 = xa + 2, yb = y0 + 2, sw = xb - x0, sh = y1 - yb;
        const ty = floor(hsh(ia >> 1, j >> 1, s ^ 0x71) * 3 + hsh(ia, j, s ^ 0x72) * 0.7) % 3;
        const nx = max(1, round((sw + 1) / BPX[ty])), ny = max(1, round((sh + 1) / BPY[ty]));
        // a district is quick and open or slow and dense, and is drawn brighter the quicker it is
        const dv = hsh(ia, j, s ^ 0x73), sb = 0.55 * exp(dv), tb = 0.9 - 0.07 * dv;
        fillR(x0, yb, xb, y1, 0, sb, tb);
        for (let k = 1; k < nx; k++) { const x = x0 + floor(k * (sw + 1) / nx) - 1; fillR(x, yb, x + 1, y1, 1, 0.72 * sb, tb + 0.08); }
        for (let k = 1; k < ny; k++) { const y = yb + floor(k * (sh + 1) / ny) - 1; fillR(x0, y, xb, y + 1, 1, 0.72 * sb, tb + 0.08); }
        if (hsh(ia, j, s ^ 0x74) < 0.34) {
          const bx = floor(hsh(ia, j, s ^ 0x75) * nx), by = floor(hsh(ia, j, s ^ 0x76) * ny);
          const ex = hsh(ia, j, s ^ 0x77) < 0.6 && bx + 1 < nx ? 2 : 1, ey = hsh(ia, j, s ^ 0x78) < 0.6 && by + 1 < ny ? 2 : 1;
          fillR(x0 + (bx ? floor(bx * (sw + 1) / nx) : 0), yb + (by ? floor(by * (sh + 1) / ny) : 0),
            x0 + floor((bx + ex) * (sw + 1) / nx) - 1, yb + floor((by + ey) * (sh + 1) / ny) - 1, 3, S_PARK, T_PARK);
        }
        if (hsh(ia, j, s ^ 0x79) < 0.4 && st.nl < 24) {
          // a lake: nothing crosses it
          const o = st.nl++ * 4, rx = 3.6 + 3.6 * hsh(ia, j, s ^ 0x7a), ry = 3.6 + 3.6 * hsh(ia, j, s ^ 0x7b);
          st.lk[o] = x0 + rx + 1 + (sw - 2 * rx - 2) * hsh(ia, j, s ^ 0x7c); st.lk[o + 1] = yb + ry + 1 + (sh - 2 * ry - 2) * hsh(ia, j, s ^ 0x7d);
          st.lk[o + 2] = rx; st.lk[o + 3] = ry;
          if (abs(st.lk[o] - pathX(st, st.lk[o + 1])) < rx + 7) st.nl--;
        }
      }
      fillR(xa, y0 + 2, xa + 2, y1, 2, S_ART, T_ART);
      xa = xb; ia = i;
      if (xa >= ox + GW) break;
    }
    fillR(ox, y0, ox + GW, y0 + 2, 2, S_ART, T_ART);
    if (hsh(j, 5, s ^ 0xb1) < 0.68) for (let y = y0; y < y0 + 2; y++) if (y >= oy && y < oy + GH) br[y - oy] = 1;
    if (crossR(j, s)) {
      // a tributary: between two avenues, on one side of the river; some avenues bridge it
      const yc = (y0 + y1) / 2 + 1, p1 = 6.28 * hsh(j, 7, s), p2 = 6.28 * hsh(j, 8, s), side = hsh(j, 9, s) < 0.5 ? 1 : -1;
      const f = (u) => yc + 5.5 * sin(0.071 * u + p1) + 3 * sin(0.163 * u + p2);
      for (let xx = 0; xx < GW; xx++) {
        const x = ox + xx, yr = f(x), sl = (f(x + 1) - f(x - 1)) / 2, hw = 2.9 * sqrt(1 + sl * sl);
        if ((x - riverX(st, yr)) * side < 0) continue;
        const bridge = hsh(floor(x / PITCH), j, s ^ 0xc4) < 0.55;
        for (let y = max(y0 + 3, oy, ceil(yr - hw - 1)); y <= min(y1 - 2, oy + GH - 1, floor(yr + hw + 1)); y++) {
          const n = (y - oy + PAD) * AW + xx + PAD;
          if (cls[n] === 2 && bridge) continue;
          const cov = cl(hw + 0.5 - abs(y - yr), 0, 1);
          if (cov > wat[n]) wat[n] = cov;
          if (cov > 0.5) { cls[n] = 4; slb[n] = WALL; }
        }
      }
    }
  }
  // the river: a band five to seven LEDs wide, crossed only where an avenue bridges it
  for (let yy = 0; yy < GH; yy++) {
    if (br[yy]) continue;
    const y = oy + yy, xr = riverX(st, y), sl = (riverX(st, y + 1) - riverX(st, y - 1)) * 0.5;
    const hw = (2.9 + 0.5 * sin(0.043 * y + st.ph[6])) * sqrt(1 + min(sl * sl, 2.5));
    const x0 = max(ceil(xr - hw - 1) - ox, 0), x1 = min(floor(xr + hw + 1) - ox, GW - 1);
    const r = (yy + PAD) * AW + PAD;
    for (let x = x0; x <= x1; x++) {
      const cov = cl(hw + 0.5 - abs(x + ox - xr), 0, 1);
      if (cov > wat[r + x]) wat[r + x] = cov;
      if (cov > 0.5) { cls[r + x] = 4; slb[r + x] = WALL; }
    }
  }
  for (let q = 0; q < st.nl; q++) {
    const cx = st.lk[q * 4], cy = st.lk[q * 4 + 1], rx = st.lk[q * 4 + 2], ry = st.lk[q * 4 + 3], rm = min(rx, ry);
    const x0 = max(ceil(cx - rx - 1) - ox, 0), x1 = min(floor(cx + rx + 1) - ox, GW - 1), y0 = max(ceil(cy - ry - 1) - oy, 0), y1 = min(floor(cy + ry + 1) - oy, GH - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ex = (x + ox - cx) / rx, ey = (y + oy - cy) / ry, cov = cl((1 - sqrt(ex * ex + ey * ey)) * rm + 0.5, 0, 1), n = (y + PAD) * AW + x + PAD;
      if (cov > wat[n]) wat[n] = cov;
      if (cov > 0.5) { cls[n] = 4; slb[n] = WALL; }
    }
  }
  // the traveller's own track: a lane through the blocks and a causeway over any water
  for (let yy = 0; yy < GH; yy++) {
    const px = pathX(st, oy + yy) - ox;
    for (let x = max(0, ceil(px - 2.6)); x <= min(GW - 1, floor(px + 2.6)); x++) {
      const n = (yy + PAD) * AW + x + PAD;
      if (wat[n] > 0) { wat[n] = 0; if (cls[n] === 4) cls[n] = 0; }
      if (cls[n] === 0 && (slb[n] >= BIG || abs(x - px) <= 1.5)) { cls[n] = 1; slb[n] = S_ST; txb[n] = T_ST; }
    }
  }
  // the metro: a small square round each station that falls on the window
  const k0 = (st.k0 = floor((oy - 190) / 46));
  for (let q = 0; q < NST; q++) {
    const p = station(st, k0 + q), x = p.x - ox, y = p.y - oy;
    st.stx[q] = p.x; st.sty[q] = p.y; st.stn[q] = -1;
    if (x < 1 || y < 1 || x >= GW - 1 || y >= GH - 1) continue;
    const n = (y + PAD) * AW + x + PAD;
    if (cls[n] === 4) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const m = n + dy * AW + dx;
      if (cls[m] === 0 || cls[m] === 3) { cls[m] = 1; slb[m] = S_ST; txb[m] = T_ST; }
    }
    cls[n] = 5;
    st.stn[q] = n;
  }
}

// ---- travel times -------------------------------------------------------------------
// Dijkstra from the traveller, sixteen neighbours, buckets as wide as the cheapest step
const OA = new Int32Array(16), OB = new Int32Array(16), OC = new Int32Array(16), OK = new Float64Array(16);
{
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
  for (let q = 0; q < 16; q++) {
    const dx = D[q][0], dy = D[q][1];
    OA[q] = dy * AW + dx;
    if (q < 4) { OB[q] = OC[q] = OA[q]; OK[q] = 0.25; }
    else if (q < 8) { OB[q] = dx; OC[q] = dy * AW; OK[q] = Math.SQRT2 / 4; }
    else {
      // a knight move passes through two cells on its way: a quarter of its length in each of the four
      OB[q] = abs(dy) === 2 ? (dy >> 1) * AW : dx >> 1;
      OC[q] = abs(dy) === 2 ? (dy >> 1) * AW + dx : (dx >> 1) + dy * AW;
      OK[q] = sqrt(5) / 4;
    }
  }
}

// slowness summed along the straight line from the traveller to a cell near by
function lineCost(sl, ox, oy, x0, y0, dx, dy, len) {
  let cx = round(x0), cy = round(y0), t = 0, sum = 0;
  const ax = dx > 0 ? 1 : -1, ay = dy > 0 ? 1 : -1;
  const tdx = dx ? abs(1 / dx) : 1e9, tdy = dy ? abs(1 / dy) : 1e9;
  let tx = dx ? (cx + 0.5 * ax - x0) / dx : 1e9, ty = dy ? (cy + 0.5 * ay - y0) / dy : 1e9;
  for (let g = 0; g < 40; g++) {
    const v = sl[(cy - oy + PAD) * AW + cx - ox + PAD], tn = min(tx, ty, 1);
    sum += (tn - t) * (v >= BIG ? S_SWIM : v);
    t = tn;
    if (t >= 1) break;
    if (tx < ty) { cx += ax; tx += tdx; } else { cy += ay; ty += tdy; }
  }
  return sum * len;
}

function solve(st, F, sx, sy) {
  const m = cl(st.ks[3], 0, 1);
  const ox = floor(sx) - TX - MG, oy = floor(sy) - TY - MG;
  if (ox !== st.ox || oy !== st.oy || !st.drawn) { raster(st, ox, oy); st.drawn = true; }
  F.ox = ox; F.oy = oy;
  const T = F.T, sl = st.sl, slb = st.slb, cls = st.cls, done = st.done, head = st.head, enext = st.enext, enode = st.enode, stn = st.stn;
  // at walking pace every road is alike, but a dense district still has to be walked round block by block
  const txb = st.txb;
  for (let n = 0; n < NN; n++) {
    const b = slb[n], wk = cls[n] ? S_WALK : S_WALK * (1 + 13 * (0.9 - txb[n]));
    sl[n] = b >= BIG ? WALL : (b + (wk - b) * m) * EDGE[n];
  }
  const delta = 0.98 * (S_ART + (S_WALK - S_ART) * m), inv = 1 / delta;
  const ride = RIDE + (1.2 * S_WALK - RIDE) * m, wait = WAIT + 40 * m * m * m;
  T.fill(BIG); done.fill(0); head.fill(-1);
  let ne = 0, maxb = 0;
  // seeds: the land cells within a few LEDs of the traveller, at the cost of the straight line
  const cx = round(sx), cy = round(sy);
  for (let R = 4.6, found = 0; !found && R < 14; R += 4) {
    const ri = ceil(R);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const px = cx + dx, py = cy + dy, ex = px - sx, ey = py - sy, d = sqrt(ex * ex + ey * ey);
      if (d > R) continue;
      const n = (py - oy + PAD) * AW + px - ox + PAD;
      if (sl[n] >= BIG) continue;
      const c = lineCost(sl, ox, oy, sx, sy, ex, ey, d);
      if (c < T[n]) {
        T[n] = c; found = 1;
        const b = (c * inv) | 0;
        if (b < NBK) { enode[ne] = n; enext[ne] = head[b]; head[b] = ne++; if (b > maxb) maxb = b; }
      }
    }
  }
  for (let b = 0; b <= maxb; b++) {
    let e;
    while ((e = head[b]) >= 0) {
      head[b] = enext[e];
      const n = enode[e];
      if (done[n]) continue;
      done[n] = 1;
      const d = T[n];
      if (n >= NN) {
        // a platform: ride to the next one either way, or step out into the street
        const q = n - NN;
        for (let g = -1; g <= 1; g++) {
          const p = q + g;
          if (p < 0 || p >= NST) continue;
          const mm = g ? NN + p : stn[q];
          if (mm < 0 || done[mm]) continue;
          const nd = d + (g ? DWELL + ride * st.hop[g < 0 ? p : q] : delta);
          if (nd < T[mm]) {
            T[mm] = nd;
            const bb = (nd * inv) | 0;
            if (bb < NBK && ne < NE) { enode[ne] = mm; enext[ne] = head[bb]; head[bb] = ne++; if (bb > maxb) maxb = bb; }
          }
        }
        continue;
      }
      if (cls[n] === 5) for (let q = 0; q < NST; q++) if (stn[q] === n) {
        const mm = NN + q, nd = d + wait - delta;
        if (nd < T[mm]) {
          T[mm] = nd;
          const bb = (nd * inv) | 0;
          if (bb < NBK && ne < NE) { enode[ne] = mm; enext[ne] = head[bb]; head[bb] = ne++; if (bb > maxb) maxb = bb; }
        }
      }
      const s0 = sl[n];
      for (let q = 0; q < 16; q++) {
        const mm = n + OA[q];
        if (done[mm]) continue;
        const nd = d + OK[q] * (s0 + sl[mm] + (q < 4 ? s0 + sl[mm] : sl[n + OB[q]] + sl[n + OC[q]]));
        if (nd < T[mm]) {
          T[mm] = nd;
          const bb = (nd * inv) | 0;
          if (bb < NBK && ne < NE) { enode[ne] = mm; enext[ne] = head[bb]; head[bb] = ne++; if (bb > maxb) maxb = bb; }
        }
      }
    }
  }
}

// ---- state --------------------------------------------------------------------------
const bandW = (k3) => 7 * exp(-0.52 * cl(k3, -1, 1));     // travel time across one band
const field = () => ({ T: new Float64Array(NN + NST), ox: 0, oy: 0 });

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 7; i++) ph.push(2 * PI * Math.random());
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, drawn: false,
    seed: floor(Math.random() * 1e9) | 0, ph,
    sy: floor(4000 * Math.random()), v: 4, phi: Math.random(), acc: 0,
    ox: 0, oy: 0, k0: 0,
    cls: new Uint8Array(NN), slb: new Float32Array(NN).fill(WALL), sl: new Float32Array(NN).fill(WALL),
    txb: new Float32Array(NN), wat: new Float32Array(NN), bridge: new Uint8Array(GH),
    fa: field(), fb: field(),
    done: new Uint8Array(NN + NST), head: new Int32Array(NBK), enext: new Int32Array(NE), enode: new Int32Array(NE),
    lk: new Float64Array(96), nl: 0, stn: new Int32Array(NST), stx: new Float64Array(NST), sty: new Float64Array(NST), hop: new Float64Array(NST),
    tv: new Float64Array(VW * VH), lut: new Float32Array(NB * 4), fb3: new Float32Array(W * H * 3),
  });
  // start with the river on the panel beside the traveller, no second river in sight and an avenue close by
  for (let g = 0; g < 900; g++, st.sy -= 3) {
    const o = abs(rivOff(st, st.sy)), j = floor(st.sy / PITCH);
    let ok = o > 10 && o < 24 && min(abs(st.sy - artY(j, st.seed)), abs(st.sy - artY(j + 1, st.seed))) < 9;
    for (let q = -3; q <= 2; q++) if (crossR(j + q, st.seed)) ok = false;
    if (ok) break;
  }
  return st;
}

function solveAt(st, F, lead) {
  const sy = st.sy - st.v * lead;
  // the hops of the metro line near the window
  const k0 = floor((floor(sy) - TY - MG - 190) / 46);
  let px = 0, py = 0;
  for (let q = 0; q < NST; q++) {
    const p = station(st, k0 + q);
    if (q) st.hop[q - 1] = sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
    px = p.x; py = p.y;
  }
  solve(st, F, pathX(st, sy), sy);
}

function step(st, dt) {
  const k = st.k, ks = st.ks;
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  const spd = cl(ks[1], 0.3, 3), w = bandW(ks[2]);
  st.v = 1.3 + 1.5 * spd;
  st.sy -= st.v * dt;
  st.phi += (0.9 + 1.9 * spd) * sqrt(w / 7) / w * dt;
  st.phi -= floor(st.phi);
  st.acc += dt;
  if (st.acc >= SOLVE) {
    st.acc = min(st.acc - SOLVE, SOLVE);
    const f = st.fa; st.fa = st.fb; st.fb = f;
    solveAt(st, f, SOLVE - st.acc);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    step(st, 0);
    solveAt(st, st.fa, 0);
    solveAt(st, st.fb, SOLVE);
  }
  if (dt > 0) step(st, dt);
}

// ---- drawing ------------------------------------------------------------------------
const tmp = [0, 0, 0];
const NAVY = [5, 26, 92];
// a soft white dot at any place between LEDs; moat darkens a ring round it
function dot(fb, cx, cy, sg, amp, moat) {
  const x0 = max(0, ceil(cx - 5)), x1 = min(W - 1, floor(cx + 5)), y0 = max(0, ceil(cy - 5)), y1 = min(H - 1, floor(cy + 5));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy), e = min(1, amp * exp(-d2 / (2 * sg * sg)));
    const dr = sqrt(d2) - 2.7, k = 1 - moat * exp(-dr * dr / 0.7), p = (y * W + x) * 3;
    fb[p] = fb[p] * k + (255 - fb[p] * k) * e; fb[p + 1] = fb[p + 1] * k + (255 - fb[p + 1] * k) * e; fb[p + 2] = fb[p + 2] * k + (255 - fb[p + 2] * k) * e;
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const ks = st.ks, sy = st.sy, sx = pathX(st, sy);
  const bx = floor(sx) - TX, by = floor(sy) - TY, fx = sx - floor(sx), fy = sy - floor(sy);
  const A = st.fa, B = st.fb, TA = A.T, TB = B.T, a = cl(st.acc / SOLVE, 0, 1);
  const tv = st.tv, cls = st.cls, wat = st.wat, txb = st.txb, lut = st.lut, fb = st.fb3;
  const rA = (by - A.oy + PAD) * AW + bx - A.ox + PAD, rB = (by - B.oy + PAD) * AW + bx - B.ox + PAD;
  const rM = (by - st.oy + PAD) * AW + bx - st.ox + PAD;
  const TFAR = 3 * TREF;
  // the two newest fields, blended, over the cells under the panel
  for (let j = 0; j < VH; j++) for (let i = 0; i < VW; i++) {
    const o = j * AW + i, ta = TA[rA + o], tb = TB[rB + o];
    let t = ta >= BIGH ? tb : tb >= BIGH ? ta : ta + (tb - ta) * a;
    if (t >= BIGH && cls[rM + o] !== 4) t = TFAR;
    tv[j * VW + i] = t;
  }
  // a colour to each band: warm and bright next to the traveller, cool and dimmer far out
  const w = bandW(ks[2]), iw = 1 / w, phi = st.phi;
  for (let q = 0; q < NB; q++) {
    const z = (q - 0.5 + phi) * w / TREF, zc = cl(z, 0, 1);
    // the ramp hurries through the reds, which an LED shows as one colour
    hsv(ks[0] + HUE0 - SPAN * (zc + 0.07 * (sin(2 * PI * (zc - 0.375)) + 0.7071)), 1, 1 - 0.15 * zc, tmp);
    const Y = 0.299 * tmp[0] + 0.587 * tmp[1] + 0.114 * tmp[2], lift = max(0, 0.34 - Y) * 0.55;
    lut[q * 4] = 255 * min(1, tmp[0] + lift); lut[q * 4 + 1] = 255 * min(1, tmp[1] + lift); lut[q * 4 + 2] = 255 * min(1, tmp[2] + lift);
    lut[q * 4 + 3] = LO + (1 - LO) * sstep(1.3, 1.9, z);      // how dim the tail of the band falls
  }
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * VW + x, mm = rM + y * AW + x;
      const t00 = tv[o], t10 = tv[o + 1], t01 = tv[o + VW], t11 = tv[o + VW + 1];
      const rc = w00 * wat[mm] + w10 * wat[mm + 1] + w01 * wat[mm + AW] + w11 * wat[mm + AW + 1];
      let T = -1, g = 0.8;
      if (t00 < BIGH && t10 < BIGH && t01 < BIGH && t11 < BIGH) {
        T = w00 * t00 + w10 * t10 + w01 * t01 + w11 * t11;
        const gx = (t10 - t00) * (1 - fy) + (t11 - t01) * fy, gy = (t01 - t00) * (1 - fx) + (t11 - t10) * fx;
        g = sqrt(gx * gx + gy * gy);
      } else {
        let wl = 0, ts = 0;
        if (t00 < BIGH) { wl += w00; ts += w00 * t00; }
        if (t10 < BIGH) { wl += w10; ts += w10 * t10; }
        if (t01 < BIGH) { wl += w01; ts += w01 * t01; }
        if (t11 < BIGH) { wl += w11; ts += w11 * t11; }
        if (wl > 1e-3) T = ts / wl;
      }
      let r = NAVY[0], gg = NAVY[1], b = NAVY[2];
      if (T >= 0) {
        const v = T * iw - phi, kf = floor(v), f = v - kf, du = cl(g * iw, 0.02, 2);
        let q = min(NB - 2, kf + 1) * 4;
        // a sawtooth across the band: bright at its leading edge, fading behind
        const sf = min(0.5, 3.5 * du), sh = f < sf ? 1 - f / sf : 0;
        let lv = lut[q + 3], bb = 1 - (1 - lv) * sh * sh;
        let cr = lut[q] * bb, cg = lut[q + 1] * bb, cb = lut[q + 2] * bb;
        if (f > 1 - 0.5 * du) {
          const e = 0.5 - (1 - f) / du; q += 4; lv = lut[q + 3];
          cr += (lut[q] * lv - cr) * e; cg += (lut[q + 1] * lv - cg) * e; cb += (lut[q + 2] * lv - cb) * e;
        } else if (f < 0.5 * du && q >= 4) {
          const e = 0.5 - f / du; q -= 4;
          cr += (lut[q] - cr) * e; cg += (lut[q + 1] - cg) * e; cb += (lut[q + 2] - cb) * e;
        }
        const tx = (w00 * txb[mm] + w10 * txb[mm + 1] + w01 * txb[mm + AW] + w11 * txb[mm + AW + 1]) * (1 - rc);
        r = cr * tx + r * rc; gg = cg * tx + gg * rc; b = cb * tx + b * rc;
      }
      const p = (y * W + x) * 3;
      fb[p] = r; fb[p + 1] = gg; fb[p + 2] = b;
    }
  }
  // the stations as small soft marks, and the traveller: a white point in a dark moat
  for (let q = 0; q < NST; q++) if (st.stn[q] >= 0) dot(fb, st.stx[q] - sx + TX, st.sty[q] - sy + TY, 0.95, 0.8, 0);
  dot(fb, TX, TY, 0.9, 1.7, 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 3;
    display.setPixel(x, y, (fb[p] + 0.5) | 0, (fb[p + 1] + 0.5) | 0, (fb[p + 2] + 0.5) | 0);
  }
}
