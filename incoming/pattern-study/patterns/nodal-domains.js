// ===== Patternflow pattern =====
// Title:   Nodal Domains
// Family:  noise
// Idea:    Berry's random wave, 40 plane waves of one wavelength in random directions each drifting at its own frequency, cut at a level into its nodal domains, each domain one flat colour that stays with it from frame to frame and runs from rose to gold above the level and from violet to cyan below as the domain grows, the largest one pale, while a white spark marks each saddle where two domains just merged or one just split.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: random wave model (Michael Berry, 1977), with the percolation picture of nodal domains (Eugene Bogomolny and Charles Schmit, 2002)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wavenumber=0..1, Level=-1..1
//
// Knob 1: Hue. Turns every colour around the wheel together. At 0 the domains above the level run from rose through orange to gold and those below from blue violet to cyan, with the largest domain cream or sky blue; at 0.25 above is lime to green and below pink to violet, at 0.5 the two sides trade warm and cool.
// Knob 2: Speed. Each wave turns its phase at its own rate, drawn from a normal law with a spread of 0.3 radians a second per unit: 0.6 at the opening 2, where a domain changes shape within a second or two and the panel sees about 55 merges and as many splits a second; 0.06 at 0.2, and 0.9 at 3.
// Knob 3: Wavenumber. The wavelength of all 40 waves, 8 LEDs at 0 and 5.5 at 1, zooming about the middle of the panel. Bogomolny and Schmit's count for an area the size of the panel goes from 25 domains to 53; the panel shows about 54 and 95, because its edges cut domains into pieces.
// Knob 4: Level. Where psi is cut, in units of its standard deviation; it opens at 0.06, next to the critical level 0, where domains of both signs can reach across the panel. At 1 only 16% of the panel lies above the level, the warm side breaks into about 100 islands and one cool domain holds 85% of the panel; at -1 the same with the sides swapped.

const W = 64, H = 128, N = W * H, J = 40, MAXID = 4096;
const { floor, abs, sqrt, sin, cos, log, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Bogomolny and Schmit: nodal domains per unit of k^2 / (4 pi) of area,
// which is the number of eigenvalues below k^2 per unit area (Weyl).
const BS = (3 * sqrt(3) - 5) / PI;

// Colour follows a domain's size. Above the level a domain runs from rose
// when it is a single lobe of a few LEDs through orange to gold when it is
// as big as 1,500 LEDs; below the level from blue violet through blue to
// cyan. Each domain keeps a small hue offset of its own, and the largest
// domain on the panel is drawn in a light tint, cream above the level and
// sky blue below.
const RAMP = [[0.97, 0.8, 1, 0.13, 0.95, 1], [0.7, 0.75, 0.95, 0.5, 0.9, 0.95]];
const PALE = [[0.57, 0.5, 1], [0.14, 0.38, 1]];
const A0 = log(8), A1 = log(1500);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, wn: 0, lev: 0.06, k: -1, nc: 0, count: 0, bulk: 0,
    th: new Float64Array(J), ph: new Float64Array(J), om: new Float64Array(J),
    AR: new Float64Array(W * J), AI: new Float64Array(W * J), CR: new Float64Array(J), CI: new Float64Array(J), SR: new Float64Array(J), SI: new Float64Array(J),
    V: new Float64Array(N), sg: new Uint8Array(N), par: new Int32Array(N), comp: new Int32Array(N),
    area: new Int32Array(N), csign: new Uint8Array(N), cid: new Int32Array(N),
    id: new Int32Array(N).fill(-1), fl: new Float32Array(N), dec: new Uint8Array(N), dec0: new Uint8Array(N),
    idSign: new Uint8Array(MAXID), idHue: new Float64Array(MAXID), idLA: new Float64Array(MAXID), bigId: -1, used: new Uint8Array(MAXID), taken: new Uint8Array(MAXID),
    free: [], pairs: new Map(), c: [0, 0, 0],
  });
  for (let i = MAXID - 1; i >= 0; i--) S.free.push(i);
  // Wave directions spread over half a turn, one in each of J equal slots at
  // a random place in it; phases uniform; each wave its own frequency.
  for (let j = 0; j < J; j++) {
    S.th[j] = (PI * (j + Math.random())) / J;
    S.ph[j] = 2 * PI * Math.random();
    S.om[j] = gauss();
  }
}

function find(par, p) {
  while (par[p] !== p) p = par[p] = par[par[p]];
  return p;
}
function union(par, a, b) {
  a = find(par, a);
  b = find(par, b);
  if (a < b) par[b] = a;
  else if (b < a) par[a] = b;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.wn = cl(kv[2], 0, 1);
  S.lev = cl(kv[3], -1, 1);
  // Wavelength in LEDs: 8 at 0, 5.5 at 1.
  const lam = 8 / (1 + 0.4545 * S.wn), k = (2 * PI) / lam;
  const AR = S.AR, AI = S.AI, CR = S.CR, CI = S.CI, SR = S.SR, SI = S.SI, th = S.th, ph = S.ph, om = S.om;
  if (k !== S.k) {
    S.k = k;
    for (let j = 0; j < J; j++) {
      SR[j] = cos(k * sin(th[j]));
      SI[j] = sin(k * sin(th[j]));
      for (let x = 0; x < W; x++) {
        const a = k * cos(th[j]) * (x - (W - 1) / 2);
        AR[x * J + j] = cos(a);
        AI[x * J + j] = sin(a);
      }
    }
  }
  // psi = sum_j a cos(k (x cos th + y sin th) + ph), the real part of a
  // column factor times a row factor; a = sqrt(2 / J) gives variance 1. The
  // row factor starts at the top row and turns by k sin th from row to row.
  const amp = sqrt(2 / J), V = S.V;
  for (let j = 0; j < J; j++) {
    ph[j] += d * S.speed * 0.3 * om[j];
    const b = (-k * sin(th[j]) * (H - 1)) / 2 + ph[j];
    CR[j] = amp * cos(b);
    CI[j] = amp * sin(b);
  }
  for (let y = 0; y < H; y++) {
    if (y)
      for (let j = 0; j < J; j++) {
        const r = CR[j] * SR[j] - CI[j] * SI[j];
        CI[j] = CR[j] * SI[j] + CI[j] * SR[j];
        CR[j] = r;
      }
    // The column factor's real part is even about the middle column and its
    // imaginary part odd, so one pair of sums serves a column and its mirror.
    const r = y * W;
    for (let x = 0; x < W / 2; x++) {
      const o = x * J;
      let e = 0, q = 0;
      for (let j = 0; j < J; j++) {
        e += AR[o + j] * CR[j];
        q += AI[o + j] * CI[j];
      }
      V[r + x] = e - q;
      V[r + W - 1 - x] = e + q;
    }
  }
  label(S);
  match(S, d);
  // What Bogomolny and Schmit expect for an area of the panel's size, far
  // from any edge.
  S.bulk = (BS * N * k * k) / (4 * PI);
}

// Components of {psi > c} and of {psi < c}: 4-neighbours of one sign join,
// and in a 2 by 2 cell whose corners alternate in sign the value of the
// bilinear surface at its saddle decides which diagonal pair is joined (the
// asymptotic decider), so these are the domains of the bilinear surface
// through the LEDs.
function label(S) {
  const V = S.V, sg = S.sg, par = S.par, c = S.lev, dec = S.dec0;
  // dec keeps which diagonal each cell joined, 1 or 2, for the last two
  // frames, so match can tell where a saddle crossed the level.
  S.dec0 = S.dec;
  S.dec = dec;
  dec.fill(0);
  for (let p = 0; p < N; p++) {
    sg[p] = V[p] > c ? 1 : 0;
    par[p] = p;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, s = sg[p];
      if (x < W - 1 && sg[p + 1] === s) union(par, p, p + 1);
      if (y < H - 1) {
        if (sg[p + W] === s) union(par, p, p + W);
        const q = p + W + 1;
        if (x < W - 1 && sg[q] === s && sg[p + 1] !== s && sg[p + W] !== s) {
          const a = V[p] - c, b = V[p + 1] - c, e = V[p + W] - c, f = V[q] - c;
          const sad = (a * f - b * e) / (a + f - b - e);
          if (sad > 0 === (s === 1)) union(par, p, q), (dec[p] = 1);
          else union(par, p + 1, p + W), (dec[p] = 2);
        }
      }
    }
  const comp = S.comp, area = S.area, csign = S.csign;
  let nc = 0;
  // Each root is the lowest LED of its domain, so it comes first.
  for (let p = 0; p < N; p++) {
    const r = find(par, p);
    if (r === p) {
      comp[p] = nc;
      area[nc] = 0;
      csign[nc++] = sg[p];
    } else comp[p] = comp[r];
    area[comp[p]]++;
  }
  S.nc = S.count = nc;
  let big = 0;
  for (let i = 1; i < nc; i++) if (area[i] > area[big]) big = i;
  S.big = big;
}

// Each domain takes over the colour of the old domain of its sign that it
// overlaps most, largest overlaps first. So a domain that splits keeps its
// colour on the larger piece, and of two that merge the one with the larger
// overlap keeps its colour.
function match(S, d) {
  const comp = S.comp, id = S.id, sg = S.sg, idSign = S.idSign, pairs = S.pairs, nc = S.nc, cid = S.cid, taken = S.taken, used = S.used;
  const fl = S.fl, decay = exp(-4 * d);
  for (let p = 0; p < N; p++) fl[p] *= decay;
  if (S.k === S.k0) saddles(S);
  S.k0 = S.k;
  pairs.clear();
  let run = 0, key = -1;
  for (let p = 0; p <= N; p++) {
    const o = p < N ? id[p] : -1;
    const kk = o >= 0 && idSign[o] === sg[p] ? comp[p] * MAXID + o : -1;
    if (kk !== key || p === N) {
      if (key >= 0) pairs.set(key, (pairs.get(key) || 0) + run);
      key = kk;
      run = 0;
    }
    run++;
  }
  const list = [...pairs].sort((a, b) => b[1] - a[1]);
  cid.fill(-1, 0, nc);
  taken.fill(0);
  for (const [kk] of list) {
    const ci = floor(kk / MAXID), o = kk % MAXID;
    if (cid[ci] < 0 && !taken[o]) (cid[ci] = o), (taken[o] = 1);
  }
  for (let o = 0; o < MAXID; o++) if (used[o] && !taken[o]) (used[o] = 0), S.free.push(o);
  for (let i = 0; i < nc; i++)
    if (cid[i] < 0 && S.free.length) {
      const o = S.free.pop();
      used[o] = 1;
      cid[i] = o;
      idSign[o] = S.csign[i];
      S.idHue[o] = 0.05 * (Math.random() - 0.5);
      S.idLA[o] = log(S.area[i]);
    }
  for (let p = 0; p < N; p++) id[p] = cid[comp[p]];
  // The size a colour shows eases toward the true size in about a quarter
  // of a second, so a big domain that touches a neighbour at one saddle and
  // lets go again does not flicker. The pale mark stays on the domain that
  // has it until another one is a quarter bigger.
  const e = 1 - exp(-d / 0.25), area = S.area;
  let bi = -1, top = 0;
  for (let i = 0; i < nc; i++) {
    const o = cid[i];
    S.idLA[o] += (log(area[i]) - S.idLA[o]) * e;
    if (o === S.bigId) bi = i;
    if (area[i] > top) top = area[i];
  }
  if (bi < 0 || area[bi] * 1.25 < top) S.bigId = cid[S.big];
}

// A merge or a split happens where a saddle of psi crosses the level: an LED
// changes sign, or a cell's saddle value does. Around each such place, two
// LEDs of one sign that were in different domains last frame and are in one
// now mark a merge, and two that were in one and are now apart mark a split.
// The 3 by 3 LEDs around it flash white.
function saddles(S) {
  const id = S.id, sg = S.sg, comp = S.comp, idSign = S.idSign, dec = S.dec, dec0 = S.dec0, fl = S.fl;
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = id[p];
      if (!((o >= 0 && idSign[o] !== sg[p]) || (dec[p] && dec0[p] && dec[p] !== dec0[p]))) continue;
      const x0 = x > 0 ? x - 1 : 0, x1 = x < W - 1 ? x + 1 : x, y0 = y > 0 ? y - 1 : 0, y1 = y < H - 1 ? y + 1 : y;
      let hit = false;
      for (let q = 0; q < 9 && !hit; q++) {
        const a = x - 1 + (q % 3), b = y - 1 + floor(q / 3);
        if (a < x0 || a > x1 || b < y0 || b > y1) continue;
        const u = b * W + a, ou = id[u];
        if (ou < 0 || idSign[ou] !== sg[u]) continue;
        for (let r = q + 1; r < 9; r++) {
          const a2 = x - 1 + (r % 3), b2 = y - 1 + floor(r / 3);
          if (a2 < x0 || a2 > x1 || b2 < y0 || b2 > y1) continue;
          const v = b2 * W + a2, ov = id[v];
          if (ov < 0 || sg[v] !== sg[u] || idSign[ov] !== sg[v]) continue;
          if ((ou !== ov) === (comp[u] === comp[v])) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        if (fl[p] < 1) n++;
        for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) fl[b * W + a] = 1;
      }
    }
  S.events = n;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const V = S.V, id = S.id, comp = S.comp, fl = S.fl, c = S.c, lev = S.lev, nc = S.nc;
  const R = S.R || (S.R = new Float32Array(N * 3));
  for (let i = 0; i < nc; i++) {
    const o = S.cid[i], s = S.idSign[o];
    if (S.cid[i] === S.bigId) hsv(PALE[s][0] + S.hue, PALE[s][1], PALE[s][2], c);
    else {
      const u = cl((S.idLA[o] - A0) / (A1 - A0), 0, 1), P = RAMP[s ? 0 : 1];
      hsv(P[0] + (P[3] - P[0] + (s ? 1 : 0)) * u + S.idHue[o] + S.hue, P[1] + (P[4] - P[1]) * u, P[2] + (P[5] - P[2]) * u, c);
    }
    R[i * 3] = c[0];
    R[i * 3 + 1] = c[1];
    R[i * 3 + 2] = c[2];
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, v = V[p] - lev;
      // Distance to the level line in LEDs, the value over the gradient; the
      // line is drawn dark, about one LED wide.
      const gx = ((x < W - 1 ? V[p + 1] : V[p]) - (x > 0 ? V[p - 1] : V[p])) / (x > 0 && x < W - 1 ? 2 : 1);
      const gy = ((y < H - 1 ? V[p + W] : V[p]) - (y > 0 ? V[p - W] : V[p])) / (y > 0 && y < H - 1 ? 2 : 1);
      const f = cl((abs(v) / (sqrt(gx * gx + gy * gy) + 1e-6) - 0.2) / 0.6, 0, 1);
      // A spark lights the saddle white, the line through it included.
      const q = comp[p] * 3, w = 0.85 * fl[p], g = f * (1 - w), h = 255 * w;
      display.setPixel(x, y, (R[q] * g + h) | 0, (R[q + 1] * g + h) | 0, (R[q + 2] * g + h) | 0);
    }
}
