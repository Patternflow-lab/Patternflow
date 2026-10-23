// ===== Patternflow pattern =====
// Title:   Bread Mould
// Family:  fungi
// Idea:    A time-lapse of two slices of bread on a board under the kitchen lamp: spores drift down and land, colonies spread in fuzzy rings, white at the rim and blue-green, black or orange behind it, until the slices are overrun and a fresh pair slides in from the side.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after time-lapse films of mould on bread left in a bread bin
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Mould=0..3, Speed=0.2..3, Spores=4..40, Damp=0..1
//
// Knob 1: Mould. What the air carries: the bread bin at 0 (blue-green Penicillium, black pin mould and the odd pink yeast), black bread mould at 1 (grey Rhizopus cotton and Aspergillus niger), green-gold Aspergillus and olive Cladosporium at 2, orange Neurospora with pink yeast and blood-red Serratia at 3.
// Knob 2: Speed. How fast the time-lapse runs: at 2 a pair of slices goes from the first spore to overrun in about fifteen seconds; at 0.2 the colonies creep.
// Knob 3: Spores. How many colonies start on each slice: four that grow into wide ringed discs at 4, up to forty small ones that close up fast at 40.
// Knob 4: Damp. A dry kitchen near 0, with compact velvety colonies and thin white rims; turned up, the bread greys, the mould grows faster under a long white cotton and beads of liquid stand on the older colonies.
// Buttons: K1 tap slides a fresh pair of slices in now.

const W = 64;
const H = 128;
const N = W * H;
// Each slice lives in its own 62x62 box; the pair sits one above the other.
const SW = 62;
const SH = 62;
const SN = SW * SH;
const BX = 1;
const BY = [1, 65];
// Slice time a pair stays overrun before it goes, how long after the Lab
// opens the first pair goes, and how many seconds a swap takes.
const HOLD = 1.2;
const LEAD = 2.4;
const SLIDE = 0.9;
const { min, max, floor, round, sin, cos, sqrt, atan2, exp, abs, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// A warm bulb overhead.
const TINT = [1, 0.95, 0.86];
const WHITE = [236, 238, 230];
// Each mould: how fast its front runs (LED a second of slice time), how far
// its loose hyphae reach ahead of it (s), how long it stays white, the
// colour it sporulates to and the colour it ages to, how deep its growth
// rings are, how thick its pin heads come and in what colour, and whether it
// is a smooth wet patch instead of a felt.
const MOULDS = [
  // Penicillium: velvety blue-green in growth rings behind a white margin.
  { v: 3.2, fz: 0.35, wh: 0.75, c1: [72, 156, 148], c2: [34, 88, 86], ring: 0.22, pin: 0, pc: null, gl: 0 },
  // Rhizopus, the black bread mould: grey cotton that runs, then black pin heads.
  { v: 4.2, fz: 0.9, wh: 1.2, c1: [184, 184, 176], c2: [128, 126, 120], ring: 0.04, pin: 0.3, pc: [20, 18, 24], gl: 0 },
  // Cladosporium: slow and compact, olive-black velvet with hardly a margin.
  { v: 1.8, fz: 0.15, wh: 0.2, c1: [76, 92, 58], c2: [34, 42, 30], ring: 0.12, pin: 0, pc: null, gl: 0 },
  // Aspergillus niger: a yellowish felt that fills with black heads.
  { v: 2.8, fz: 0.3, wh: 0.5, c1: [206, 192, 124], c2: [70, 62, 52], ring: 0.06, pin: 0.75, pc: [30, 26, 24], gl: 0 },
  // Aspergillus flavus: yellow-green powder.
  { v: 2.9, fz: 0.3, wh: 0.6, c1: [178, 190, 70], c2: [112, 128, 46], ring: 0.18, pin: 0, pc: null, gl: 0 },
  // Neurospora, the orange bread mould: the fastest, a loose orange fleece.
  { v: 6, fz: 1, wh: 0.5, c1: [252, 170, 80], c2: [230, 122, 52], ring: 0.05, pin: 0, pc: null, gl: 0 },
  // A pink yeast: slow, smooth and wet.
  { v: 1.3, fz: 0, wh: 0, c1: [238, 140, 156], c2: [214, 102, 124], ring: 0, pin: 0, pc: null, gl: 1 },
  // Serratia, the bacterium that makes bread look as if it bleeds.
  { v: 1.1, fz: 0, wh: 0, c1: [214, 52, 66], c2: [160, 30, 48], ring: 0, pin: 0, pc: null, gl: 1 },
];
// What the air carries at each whole turn of K1.
const MIX = [
  [0.62, 0.24, 0.08, 0, 0, 0, 0.06, 0],
  [0.14, 0.5, 0.08, 0.28, 0, 0, 0, 0],
  [0.24, 0.06, 0.22, 0, 0.48, 0, 0, 0],
  [0.06, 0.1, 0, 0, 0, 0.44, 0.24, 0.16],
];
function pick(k1, u) {
  const i = min(2, floor(k1)), f = k1 - i, A = MIX[i], B = MIX[i + 1];
  for (let t = 0, acc = 0; t < A.length; t++) if ((acc += mix(A[t], B[t], f)) > u) return t;
  return 0;
}

// The board: long-grain wood under the lamp, scored by old knife cuts.
function board(P) {
  const bg = (P.bg = new Float32Array(N * 3)), lamp = (P.lamp = new Float32Array(N)), WOOD = [128, 84, 48];
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, L = (lamp[p] = 0.8 + 0.26 * exp(-((x - 25) ** 2 + ((y - 56) * 0.5) ** 2) / 900));
    const w = x + 4 * vn(x * 0.05 + 7, y * 0.02), n = vn(w * 0.7, y * 0.03), ln = vn(w * 1.9 + 50, y * 0.012);
    const k = (0.72 + 0.32 * n - max(0, ln - 0.7) * 1.4) * L;
    for (let c = 0; c < 3; c++) bg[p * 3 + c] = (WOOD[c] + (hash(p, c + 9) - 0.5) * 6) * k * TINT[c];
  }
  for (let i = 0; i < 14; i++) {
    const a = (rnd() - 0.5) * 1.2 + (rnd() < 0.5 ? 0 : PI), len = 4 + rnd() * 10;
    for (let s = 0, x = rnd() * W, y = rnd() * H; s < len; s++, x += cos(a), y += sin(a) * 0.5) {
      const xi = round(x), yi = round(y);
      if (xi >= 0 && xi < W && yi >= 0 && yi < H) for (let c = 0; c < 3; c++) bg[(yi * W + xi) * 3 + c] *= 0.8;
    }
  }
}

// A pan loaf slice: a square body under a domed top that overhangs it at the
// shoulders, a crust two LEDs deep and baked darker over the dome, the crumb
// full of holes.
const CRUMB = [242, 226, 188];
const DENSE = [222, 186, 128];
const CR_OUT = [100, 54, 26];
const CR_IN = [194, 134, 70];
function slice() {
  const S = { mask: new Uint8Array(SN), D: new Float32Array(SN), alb: new Float32Array(SN * 3), gr: new Float32Array(SN * 3), hs: new Float32Array(SN), hp: new Float32Array(SN), nz: new Float32Array(SN), T: new Float32Array(SN), own: new Uint8Array(SN), seam: new Uint8Array(SN), sp: [], col: [] };
  const { mask, D, alb, gr, hs, hp, nz } = S, top = new Uint8Array(SN);
  const so = floor(rnd() * 99999), flip = rnd() < 0.35, lean = (rnd() - 0.5) * 5, sc = 0.96 + rnd() * 0.04, shy = 17 + rnd() * 5;
  for (let q = 0; q < SN; q++) {
    const x = q % SW, y = (q / SW) | 0;
    let py = (y + 0.5 - 31) / sc + 31, px = (x + 0.5 - 31) / sc, hw = 0;
    if (flip) py = 62 - py;
    if (py < shy) px -= lean * (1 - py / shy);
    if (py > 1 && py < 61) {
      hw = py < shy ? 30.5 * (1 - ((shy - py) / (shy - 1)) ** 2.2) ** (1 / 2.2) : py < shy + 5 ? 28.5 + 2 * cos(((py - shy) / 5) * PI * 0.5) : 28.5;
      if (py > 56) hw -= 5 - sqrt(max(0, 25 - (py - 56) ** 2));
    }
    mask[q] = abs(px) < hw ? 1 : 0;
    top[q] = py < shy + 2;
    D[q] = mask[q] ? 99 : 0;
  }
  // Distance in from the edge, two chamfer passes.
  const at = (x, y) => (x < 0 || y < 0 || x >= SW || y >= SH ? 0 : D[y * SW + x]);
  for (let y = 0; y < SH; y++)
    for (let x = 0, q = y * SW; x < SW; x++, q++) if (mask[q]) D[q] = min(D[q], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41);
  for (let y = SH - 1; y >= 0; y--)
    for (let x = SW - 1, q = y * SW + x; x >= 0; x--, q--) if (mask[q]) D[q] = min(D[q], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41);
  for (let q = 0; q < SN; q++) {
    if (!mask[q]) continue;
    const x = q % SW, y = (q / SW) | 0, d = D[q], crust = d < 2.5;
    const t = crust ? cl((d - 1) / 1.4, 0, 1) : cl((d - 2.5) / 5, 0, 1), k = crust ? (0.82 + 0.32 * vn(x * 0.4 + so, y * 0.4)) * (top[q] ? 0.84 : 1) : 0.92 + 0.12 * vn(x * 0.3 + so, y * 0.16);
    for (let c = 0; c < 3; c++) {
      alb[q * 3 + c] = (crust ? mix(CR_OUT[c], CR_IN[c], t) : mix(DENSE[c], CRUMB[c], t)) * k + (hash(q + so, c) - 0.5) * 12;
      gr[q * 3 + c] = hash(q + so, c + 3) * 2 - 1;
    }
    hs[q] = hash(q + so, 7);
    // Pin heads come in clumps.
    hp[q] = hash(q + so, 8) * (0.5 + vn(x * 0.25 + so, y * 0.25 + 9));
    // Ragged fronts: a colony reaches some crumb a little sooner than others.
    nz[q] = (vn(x * 0.3 + so, y * 0.3) - 0.5) * 0.6 + (hash(q + so, 6) - 0.5) * 0.25;
  }
  // The holes of the crumb, drawn a little tall the way the dough rose. The
  // lamp is up and to the left, so the far wall of a hole catches it.
  for (let i = 0; i < 120; i++) {
    const rx = 0.5 + 1.7 * rnd() ** 3, ry = rx * (1.05 + 0.6 * rnd()), cx = 4 + rnd() * 54, cy = 4 + rnd() * 54, dp = 0.14 + 0.2 * cl((rx - 0.5) / 1.5, 0, 1);
    for (let y = floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const q = y * SW + x;
        if (x < 0 || y < 0 || x >= SW || y >= SH || D[q] < 3.4) continue;
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, r2 = dx * dx + dy * dy;
        const f = r2 < 1 ? 1 - dp * (1 - 0.45 * cl((dx + dy) * 0.8, -1, 1)) * (1 - 0.4 * r2) : r2 < 2 && dx + dy < -0.6 ? 1 + dp * 0.3 : 1;
        alb[q * 3] *= f;
        alb[q * 3 + 1] *= f;
        alb[q * 3 + 2] *= f;
      }
  }
  // Forty landing places, each one as far from the others as twelve tries
  // can find, so the first few cover the slice whatever K3 asks for. Landing
  // times and kinds are spread the same way.
  const r0 = rnd(), r1 = rnd();
  for (let i = 0; i < 40; i++) {
    let bx = 0, by = 0, bd = -1;
    for (let c = 0; c < 12; c++) {
      let q = 0;
      do q = floor(rnd() * SN);
      while (D[q] < 2.5);
      const x = (q % SW) + rnd(), y = floor(q / SW) + rnd();
      let md = 1e9;
      for (const s of S.sp) md = min(md, (s.x - x) ** 2 + (s.y - y) ** 2);
      if (md > bd) (bd = md), (bx = x), (by = y);
    }
    S.sp.push({ x: bx, y: by, u: (r1 + i * 0.618034) % 1, t0: 0.2 + 2.8 * ((r0 + i * 0.381966) % 1), a: rnd() * 7, b: rnd() * 7, c: rnd() * 7, dx: rnd() - 0.5 });
  }
  return S;
}

// When each LED of a slice is reached: the first colony to get there owns it.
// Fronts are lobed, crust is slow ground, and the result is fixed, so a
// frame only reads it against the slice's age.
function grow(P, S) {
  const { T, own, mask, D, sp, seam, nz } = S, col = (S.col = []);
  T.fill(1e9);
  for (let i = 0; i < P.nsp; i++) {
    const s = sp[i], M = MOULDS[pick(P.k1, s.u)], iv = 1 / (M.v * P.vk);
    col.push({ M, t0: s.t0 });
    for (let q = 0; q < SN; q++) {
      if (!mask[q]) continue;
      const dx = (q % SW) + 0.5 - s.x, dy = ((q / SW) | 0) + 0.5 - s.y, d = sqrt(dx * dx + dy * dy);
      if (s.t0 + d * 0.86 * iv >= T[q]) continue;
      const a = atan2(dy, dx), t = s.t0 + d * iv * (1 + 0.05 * sin(2 * a + s.a) + 0.05 * sin(5 * a + s.b) + 0.035 * sin(11 * a + s.c));
      if (t < T[q]) (T[q] = t), (own[q] = i);
    }
  }
  let tmax = 0;
  for (let q = 0; q < SN; q++) {
    if (!mask[q]) continue;
    T[q] += nz[q] + (D[q] < 2.5 ? 0.5 : 0);
    tmax = max(tmax, T[q]);
  }
  // Where two kinds meet they leave a groove.
  for (let q = 0; q < SN; q++) {
    const m = mask[q] && col[own[q]].M, r = q % SW < SW - 1 && mask[q + 1] && col[own[q + 1]].M, dn = q + SW < SN && mask[q + SW] && col[own[q + SW]].M;
    seam[q] = m && ((r && r !== m) || (dn && dn !== m)) ? 1 : 0;
  }
  return tmax;
}

function makeSet(P) {
  const set = { s: [slice(), slice()], A: 0, L: 0 };
  regrow(P, set);
  return set;
}
function regrow(P, set) {
  set.L = max(grow(P, set.s[0]), grow(P, set.s[1])) + HOLD;
}
const crumb = (x, y) => [round(x), round(y), 0.6 + rnd() * 0.5, rnd() < 0.3];

function swap(P) {
  P.old = P.cur;
  P.cur = makeSet(P);
  P.sw = 0;
  // Crumbs knocked off on the way, in the gaps where they show.
  for (let i = 0; i < 7; i++) P.crumbs.push(crumb(rnd() * W, [0.5, 63.5, 64.5, 126.5][floor(rnd() * 4)] + (rnd() - 0.5) * 2));
  P.crumbs.splice(0, max(0, P.crumbs.length - 48));
}

export function setup(params) {
  const P = params;
  Object.assign(P, { t: 0, cur: null, old: null, sw: -1, buf: new Float32Array(N * 3), sh: new Float32Array(N), crumbs: [], motes: [], k1: -1 });
  board(P);
  for (let i = 0; i < 26; i++) P.crumbs.push(crumb(rnd() * W, rnd() * H));
  for (let i = 0; i < 12; i++) P.motes.push({ x: rnd() * W, y: rnd() * H, vx: 0, vy: 0, ph: rnd() * 7 });
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt, 0, 0.1);
  const k1 = cl(k[0], 0, 3), nsp = round(cl(k[2], 4, 40)), damp = cl(k[3], 0, 1);
  P.rate = cl(k[1], 0.2, 3) / 2;
  if (abs(k1 - P.k1) > 0.002 || nsp !== P.nsp || abs(damp - P.damp) > 0.002) {
    Object.assign(P, { k1, nsp, damp, vk: 0.85 + 0.6 * damp, fk: 1 + 1.8 * damp, wk: 1 + 1.4 * damp });
    // The first pair opens nearly overrun and goes LEAD seconds in.
    if (!P.cur) (P.cur = makeSet(P)), (P.cur.A = max(0, P.cur.L - LEAD));
    else regrow(P, P.cur);
  }
  P.t += d;
  if (P.sw >= 0) {
    if ((P.sw += d) >= SLIDE) (P.sw = -1), (P.old = null);
  } else if ((P.cur.A += d * P.rate) >= P.cur.L || input.btnPressed?.[0]) swap(P);
  for (const m of P.motes) {
    m.vx += ((rnd() - 0.5) * 24 - m.vx) * d;
    m.vy += ((rnd() - 0.5) * 24 - m.vy - 2) * d;
    m.x = (m.x + m.vx * d + W) % W;
    m.y = (m.y + m.vy * d + H) % H;
  }
}

function drawSlice(P, S, A, ox, oy) {
  const { buf, lamp, damp, fk, wk } = P, { mask, alb, gr, hs, hp, T, own, seam, col } = S;
  const dk0 = 1 - 0.14 * damp, dk1 = 1 - 0.15 * damp, dk2 = 1 - 0.07 * damp, bead = 0.012 * damp;
  for (let ly = 0; ly < SH; ly++)
    for (let lx = 0, x = ox, q = ly * SW; lx < SW; lx++, x++, q++) {
      if (x < 0 || x >= W || !mask[q]) continue;
      const q3 = q * 3, age = A - T[q];
      let r = alb[q3] * dk0, g = alb[q3 + 1] * dk1, b = alb[q3 + 2] * dk2;
      if (age > -2) {
        const c = col[own[q]], M = c.M, fz = M.fz * fk, wh = M.wh * wk;
        if (age < 0) {
          // Loose hyphae run ahead of the colony.
          if (fz > 0 && hs[q] < 0.8 * (1 + age / fz)) (r = mix(r, WHITE[0], 0.55)), (g = mix(g, WHITE[1], 0.55)), (b = mix(b, WHITE[2], 0.55));
        } else {
          let mr, mg, mb, a;
          if (M.gl) {
            const t = cl(age / 3, 0, 1), s = 1 + 0.16 * cl(1 - (T[q] - c.t0) / 2, 0, 1) + (hs[q] < 0.04 ? 0.25 : 0);
            mr = mix(M.c1[0], M.c2[0], t) * s;
            mg = mix(M.c1[1], M.c2[1], t) * s;
            mb = mix(M.c1[2], M.c2[2], t) * s;
            a = min(1, 0.55 + age * 2);
          } else {
            const t1 = cl((age - wh) / 0.7, 0, 1), t2 = cl((age - wh - 0.7) / 3, 0, 1);
            mr = mix(mix(WHITE[0], M.c1[0], t1), M.c2[0], t2);
            mg = mix(mix(WHITE[1], M.c1[1], t1), M.c2[1], t2);
            mb = mix(mix(WHITE[2], M.c1[2], t1), M.c2[2], t2);
            // Growth rings: the colony sporulates in bands as its front goes on.
            if (M.ring) {
              const k = 1 - M.ring * t1 * (0.5 + 0.5 * cos((T[q] - c.t0) * 7));
              (mr *= k), (mg *= k), (mb *= k);
            }
            // Damp air keeps a grey cotton of aerial hyphae over the old growth.
            const hz = damp * 0.45 * t1 * (0.6 + 0.4 * hs[q]);
            (mr = mix(mr, 206, hz)), (mg = mix(mg, 208, hz)), (mb = mix(mb, 200, hz));
            if (M.pin) {
              const pr = M.pin * cl((age - wh) / 2.5, 0, 1), f = hp[q] < pr ? 1 : hp[q] < pr * 1.5 ? 0.5 : 0;
              (mr = mix(mr, M.pc[0], f)), (mg = mix(mg, M.pc[1], f)), (mb = mix(mb, M.pc[2], f));
            }
            const gk = 6 + 8 * t1;
            mr += gr[q3] * gk;
            mg += gr[q3 + 1] * gk;
            mb += gr[q3 + 2] * gk;
            a = min(1, 0.4 + age * 1.6);
            // Beads of liquid on old colonies when it is damp.
            if (age > 2.5 && hs[q] > 1 - bead) (mr = 250), (mg = 246), (mb = 226), (a = 1);
          }
          if (seam[q] && age > 0.5) (mr *= 0.7), (mg *= 0.7), (mb *= 0.7);
          r = mix(r, mr, a);
          g = mix(g, mg, a);
          b = mix(b, mb, a);
        }
      }
      const p = (oy + ly) * W + x, L = lamp[p], o = p * 3;
      buf[o] = r * L;
      buf[o + 1] = g * L * TINT[1];
      buf[o + 2] = b * L * TINT[2];
    }
}

// Even steps only: the grain is there to be seen, not to be counted twice.
const q2 = (v) => (v > 255 ? 254 : v < 0 ? 0 : (v >> 1) << 1);
const ease = (u) => (u = cl(u, 0, 1)) * u * (3 - 2 * u);

export function draw(display, params) {
  const P = params, { buf, sh, lamp } = P;
  if (!P.cur) return;
  buf.set(P.bg);
  for (const [x, y, k, big] of P.crumbs)
    for (let i = 0; i <= (big ? 1 : 0); i++) {
      const p = y * W + x + i;
      if (x + i < W && y >= 0 && y < H) (buf[p * 3] = 214 * k * lamp[p]), (buf[p * 3 + 1] = 160 * k * lamp[p]), (buf[p * 3 + 2] = 86 * k * lamp[p]);
    }
  // In a swap the bottom slice follows the top one a moment later.
  const e = [0, 1].map((j) => (P.sw >= 0 ? ease((P.sw - 0.14 * j) / (SLIDE - 0.14)) : 1));
  const sets = P.sw >= 0 ? [[P.old, e.map((v) => round(-68 * v))], [P.cur, e.map((v) => round(68 * (1 - v)))]] : [[P.cur, [0, 0]]];
  // Shadows on the board, cast down and to the right.
  sh.fill(1);
  for (const [set, ox] of sets)
    for (let j = 0; j < 2; j++)
      for (let q = 0, m = set.s[j].mask; q < SN; q++) {
        if (!m[q]) continue;
        const x = BX + ox[j] + (q % SW), y = BY[j] + ((q / SW) | 0);
        if (x + 1 >= 0 && x + 1 < W && y + 2 < H) sh[(y + 2) * W + x + 1] = 0.5;
        if (x + 2 >= 0 && x + 2 < W && y + 4 < H) sh[(y + 4) * W + x + 2] = min(sh[(y + 4) * W + x + 2], 0.74);
      }
  for (let p = 0; p < N; p++) if (sh[p] < 1) (buf[p * 3] *= sh[p]), (buf[p * 3 + 1] *= sh[p]), (buf[p * 3 + 2] *= sh[p]);
  for (const [set, ox] of sets) for (let j = 0; j < 2; j++) drawSlice(P, set.s[j], set.A, BX + ox[j], BY[j]);
  // Spores settling out of the air, and dust in the lamplight.
  const add = (x, y, v) => {
    const xi = round(x), yi = round(y);
    if (xi >= 0 && xi < W && yi >= 0 && yi < H) for (let c = 0, o = (yi * W + xi) * 3; c < 3; c++) buf[o + c] += v * TINT[c];
  };
  if (P.sw < 0)
    for (let j = 0; j < 2; j++)
      for (const s of P.cur.s[j].sp.slice(0, P.nsp)) {
        const u = (s.t0 - P.cur.A) / 0.6;
        if (u > 0 && u < 1) add(BX + s.x + s.dx * 16 * u, BY[j] + s.y - 10 * u, 150 * (1 - u));
      }
  for (const m of P.motes) add(m.x, m.y, 90 * lamp[(m.y | 0) * W + (m.x | 0)] ** 4 * (0.5 + 0.5 * sin(P.t * 3 + m.ph)) ** 2);
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p & 63, p >> 6, q2(buf[o]), q2(buf[o + 1]), q2(buf[o + 2]));
}
