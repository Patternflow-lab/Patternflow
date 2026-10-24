// ===== Patternflow pattern =====
// Title:   Skydiver
// Family:  flight
// Idea:    A jump plane crosses the top of the sky and lets out a load of skydivers who punch down through the cloud deck, take grips in a ring, break off and open their ram-air canopies, then spiral down to the target circle on the drop zone while the next load is already on its way up.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after formation skydiving loads at a drop zone
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Hour=0..1, Speed=0.2..3, Divers=5..12, Wind=-1..1
//
// Knob 1: Hour. A clear midday at 0, the deep blue overhead going pale at the horizon, to the sunset load at 1, when the sun sits on the horizon, the clouds go pink and the canopies fly in warm light.
// Knob 2: Speed. At 2 a new plane comes every fifteen seconds, its divers are in freefall for about seven and under canopy for about twenty, so one load is always landing while the next is in the air. At 0.2 it all runs ten times slower.
// Knob 3: Divers. How many jump together, five to twelve. A bigger load comes in a longer plane and builds a wider ring, and as many canopies come down.
// Knob 4: Wind. The cloud deck, the far cumulus and the cloud shadows on the fields travel with it, the plane runs in against it, the windsock fills, and the canopies turn in to land facing it. Near 0 they land towards you.
// Buttons: K1 tap brings the next load in at once, and its divers go as soon as the door is over the field.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, exp, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
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

// Rows: the plane's fuselage, the flat base of the cloud deck, the horizon, the landing field.
const [PY, DB, HZ, GL] = [8, 30, 101, 118];
// Depth goes onto the screen at this scale, nearer is lower; canopies are seen flatter.
const [ZS, ZC] = [0.55, 0.3];
// Terminal velocity and the plane's speed in LEDs a second, the target, the windsock, seconds between loads.
const [VT, PV, TX, WX, CYCLE] = [8.5, 14, 34, 57, 15];
// Sky top, middle, horizon; sun; lit and shaded cloud; daylight. Midday to sunset.
const KEYS = [
  [8, 28, 104, 18, 62, 148, 112, 158, 204, 255, 250, 225, 252, 252, 255, 150, 162, 190, 1, 1, 1],
  [12, 34, 112, 56, 96, 172, 196, 190, 184, 255, 226, 160, 255, 238, 210, 146, 140, 170, 1, 0.92, 0.8],
  [20, 24, 90, 104, 84, 146, 255, 160, 84, 255, 186, 100, 255, 194, 136, 126, 96, 136, 1, 0.78, 0.58],
  [12, 12, 50, 96, 46, 104, 255, 104, 44, 255, 136, 56, 255, 136, 96, 82, 54, 92, 0.86, 0.56, 0.42],
];
const CAN = [[255, 30, 60], [255, 214, 0], [20, 110, 255], [255, 50, 190], [80, 235, 40], [255, 120, 0], [0, 220, 235], [150, 60, 255], [245, 245, 245], [255, 80, 80], [20, 190, 110], [255, 160, 200]];
const SUIT = [[255, 220, 40], [240, 40, 40], [40, 200, 255], [250, 250, 250], [255, 110, 0], [190, 70, 255], [60, 230, 90], [255, 80, 180]];
const HELM = [[250, 250, 250], [30, 30, 36], [255, 200, 0], [230, 40, 40]];
const STRIPE = [[200, 30, 40], [20, 70, 170], [230, 150, 0]];

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const P = (params.s = { t: 0, rt: 0, loads: [], next: 0, cx: 0, w: 0, f: F32(N * 3), bg: F32(N * 3), key: -1, top: F32(128), far: F32(128) });
  // Cumulus along a strip that wraps every 128 columns, each a cluster of round puffs: the deck and the far ones.
  for (const [T, nc, sz] of [[P.top, 4, 1], [P.far, 6, 0.5]])
    for (let k = 0; k < nc; k++) {
      const c = (k * 128) / nc + rnd() * 8, wd = (14 + rnd() * 14) * sz, hm = (5 + rnd() * 7) * sz;
      for (let j = 0; j < 11; j++) {
        // Bubbles stacked higher towards the middle of the cloud.
        const u = rnd() * 2 - 1, r = (2 + rnd() * 3.2) * (sz + 0.3) * 0.75, px = c + u * (wd / 2 - r * 0.5), e = max(0, (hm - r) * (1 - u * u) * (0.5 + 0.5 * rnd()));
        for (let x = 0; x < 128; x++) {
          const dx = ((((x - px) % 128) + 192) % 128) - 64;
          // A round top, and shoulders sloping down to the base.
          const ax = abs(dx);
          if (ax < r + e) T[x] = max(T[x], ax < r ? e + Math.sqrt(r * r - dx * dx) : e + r - ax);
        }
      }
    }
}

const shuffle = (n) => {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// A load: the plane runs in against the wind and puts the ring upwind of the target.
function spawn(P, n, btn) {
  // A big load gets out of the door faster, so every ring has the same time to build.
  const w = P.w, dir = w >= 0 ? -1 : 1, len = 17 + n, ex = (0.5 + 0.06 * n) / (n - 1), half = ((n - 1) * ex) / 2, x0 = dir < 0 ? 66 : -2;
  const te0 = btn ? 1.3 : max(1.3, (dir * (31 - 12 * w - x0) + len - 12) / PV - half);
  const cx = x0 + dir * PV * (te0 + half) - dir * (len - 12), ci = shuffle(CAN.length), si = shuffle(SUIT.length), rk = shuffle(n), lp = shuffle(n);
  const d = [];
  for (let i = 0; i < n; i++) {
    // Exit time, canopy colours (white or a second colour in the middle cells), suit, helmet,
    // descent rate under canopy, which way the spiral turns, and the spot on the field.
    d.push({
      i, te: te0 + i * ex, st: 0, x: 0, y: 0, z: 0, h: 0, g: 0, o: 0, rank: rk[i], can: ci[i], cb: rnd() < 0.5 ? 8 : ci[(i + 5) % 12], suit: si[i % 8], helm: floor(rnd() * 4),
      zd: rnd() * 2 - 1, k: 2.2 + rnd() * 1.2, om: (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 0.4), lx: TX + (lp[i] / (n - 1) - 0.5) * 26 + rnd() * 2, lz: rnd() * 12 - 4,
    });
  }
  P.loads.push({ t: 0, n, dir, len, x0, te0, cx, px: x0, rot0: rnd() * TAU, rr: 4.6 / sin(PI / n), tb: te0 + 2 * half + 4.2, d, sc: STRIPE[floor(rnd() * 3)] });
  if (P.loads.length > 4) P.loads.shift();
}

const fall = (s) => (s <= 0 ? 0 : VT * (s - (1 - exp(-1.5 * s)) / 1.5));
const thr = (s) => (s <= 0 ? 0 : (PV * (1 - exp(-1.4 * s))) / 1.4);

function runLoad(P, L, d) {
  const T = (L.t += d), w = P.w, dir = L.dir, n = L.n;
  L.px = L.x0 + dir * PV * T;
  const s0 = T - L.te0, ccx = L.cx + w * 2 * max(0, s0), ccy = PY + 3 + fall(s0 - 0.15), rot = L.rot0 + 0.25 * s0;
  const hf = atan2(1 - 0.9 * abs(w), -w), cf = cos(hf), sf = sin(hf);
  for (const D of L.d) {
    if (!D.st && T >= D.te) (D.st = 1), (D.xd = L.x0 + dir * PV * D.te - dir * (L.len - 6));
    if (D.st === 1 && T >= L.tb) {
      // Break-off: where the ring was, frozen, then turn away and track out.
      const sb = L.tb - L.te0, th = L.rot0 + 0.25 * sb + (TAU * D.i) / n;
      Object.assign(D, { st: 2, th, bx: L.cx + w * 2 * sb + L.rr * cos(th), bz: L.rr * sin(th), by: PY + 3 + fall(sb - 0.15) });
    }
    if (D.st === 1) {
      const s = T - D.te, th = rot + (TAU * D.i) / n, g = sm(0.4, 2.3, s);
      D.x = mix(D.xd + dir * thr(s) + w * 2 * s, ccx + L.rr * cos(th), g);
      D.y = mix(PY + 3 + fall(s), ccy, g);
      D.z = mix(D.zd, L.rr * sin(th), g);
      D.h = th + PI;
      D.g = g;
    } else if (D.st === 2) {
      const sb = T - L.tb, out = (10 + 0.6 * n) * (1 - exp(-1.1 * sb));
      D.x = cl(D.bx + cos(D.th) * out, 2, 61);
      D.z = D.bz + sin(D.th) * out * 0.6;
      D.y = D.by + 9.5 * sb;
      D.h = D.th + PI + PI * sm(0, 0.6, sb);
      D.g = 0;
      if (sb >= 0.7 + (1.4 * D.rank) / (n - 1)) Object.assign(D, { st: 3, td: T, yd: D.y, vy: 9.5, ax: D.x, az: D.z, h0: D.h });
    } else if (D.st === 3) {
      // Under canopy: open, slow down, spiral in over the field and turn to land.
      const sc = T - D.td;
      D.o = min(1, sc / 0.9);
      D.vy += ((D.y > GL - 5 ? 1.3 : D.o > 0.55 ? D.k : 9.5) - D.vy) * min(1, 5 * d);
      D.y += D.vy * d;
      const pr = cl((D.y - D.yd) / (GL - D.yd), 0, 1), fx = D.lx - cf * 8, fz = D.lz - sf * 8;
      if (pr < 0.8) {
        const e = sm(0, 0.8, pr), r = 13 * sin(PI * (pr / 0.8)) ** 0.6, h = D.h0 + D.om * sc, sg = D.om > 0 ? 1 : -1;
        // The wind carries the spiral downwind on the way down, and the last turn brings it back.
        D.x = mix(D.ax, fx, e) + sg * r * sin(h) + w * 12 * sin(PI * e);
        D.z = mix(D.az, fz, e) - sg * r * cos(h);
        const b = sm(0.65, 0.8, pr);
        D.h = atan2(mix(sin(h), sf, b), mix(cos(h), cf, b));
      } else {
        const q = sm(0.8, 1, pr);
        (D.x = mix(fx, D.lx, q)), (D.z = mix(fz, D.lz, q)), (D.h = hf);
      }
      D.x = cl(D.x, 3, 60);
      D.fl = sm(GL - 5, GL, D.y);
      if (D.y >= GL) Object.assign(D, { st: 4, tl: T, y: GL, x: D.lx, z: D.lz, h: hf });
    } else if (D.st === 4 && T - D.tl > 7.5) D.st = 5;
  }
}

function tick(P, d, n) {
  P.t += d;
  P.cx += (3.2 + 9 * P.w) * d;
  if ((P.next -= d) <= 0) spawn(P, n, 0), (P.next += CYCLE);
  for (const L of P.loads) runLoad(P, L, d);
  P.loads = P.loads.filter((L) => L.t < 60 && L.d.some((D) => D.st < 5));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], rd = cl(dt || 0, 0, 0.1), d = rd * (cl(k[1], 0.2, 3) / 2), n = round(cl(k[2], 5, 12));
  P.w = cl(k[3], -1, 1);
  P.h = cl(k[0], 0, 1);
  P.rt += rd;
  // One load landing, one high under canopy, and the third plane on its run.
  if (!P.ready) {
    P.ready = 1;
    P.next = 1e9;
    for (const s of [0, 19, 30, 32.5]) {
      while (P.t < s - 1e-6) tick(P, 1 / 15, n);
      s < 32 && spawn(P, n, 0);
    }
    P.next = CYCLE - 2.5;
  }
  if (input.btnPressed && input.btnPressed[0]) spawn(P, n, 1), (P.next = CYCLE);
  tick(P, d, n);
}

let F, LT, K;
const at = (x, y) => ((x = round(x)), (y = round(y)), x < 0 || x >= W || y < 0 || y >= H ? -1 : (y * W + x) * 3);
function put(x, y, c, a = 1) {
  const o = at(x, y);
  if (o >= 0) for (let i = 0; i < 3; i++) F[o + i] = mix(F[o + i], c[i], a);
}
function seg(x0, y0, x1, y1, c, a = 1) {
  const n = max(abs(x1 - x0), abs(y1 - y0)) * 1.4 + 1;
  for (let i = 0; i <= n; i++) put(mix(x0, x1, i / n), mix(y0, y1, i / n), c, a);
}
const lit = (c, k = 1) => [c[0] * LT[0] * k, c[1] * LT[1] * k, c[2] * LT[2] * k];
const KC = (i) => [K[i], K[i + 1], K[i + 2]];

// Sky, sun, hills and the drop zone, kept until the hour moves.
function backdrop(P) {
  const B = P.bg, h = P.h, key = round(h * 300);
  if (key === P.key) return;
  P.key = key;
  const zen = KC(0), mid = KC(3), hor = KC(6), sun = KC(9), sy = mix(-16, 90, sm(0.3, 1, h));
  const FIELDS = [[74, 124, 44], [112, 140, 52], [150, 146, 72], [60, 104, 48], [126, 112, 64]];
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3;
    let c;
    const hill = HZ - 1.5 - 2.5 * vn(x * 0.09, 50);
    if (y < hill) {
      const f = y / HZ, u = f < 0.6 ? sm(0, 1, f / 0.6) : ((f - 0.6) / 0.4) ** 1.6;
      c = f < 0.6 ? zen.map((v, j) => mix(v, mid[j], u)) : mid.map((v, j) => mix(v, hor[j], u));
      const ds = Math.hypot(x - 47, (y - sy) * 1.1), g = 0.5 * exp(-ds / 9) + 0.25 * exp(-ds / 30);
      c = ds < 3.6 ? sun : c.map((v, j) => v + sun[j] * g * (0.4 + 0.6 * h));
    } else if (y < HZ) {
      c = lit(hor.map((v, j) => mix(v, [44, 72, 70][j], 0.6)));
    } else {
      const zf = y - HZ + 2, gx = ((x - 32) * 24) / zf, gz = 260 / zf;
      if (y >= 104 && y <= 106) c = y === 105 && (floor(gx / 5) & 3) === 0 ? [220, 220, 220] : [92, 92, 98];
      else if (y >= 109) c = [70, 150, 48].map((v) => v * (floor(gx / 7) & 1 ? 0.86 : 1));
      else c = FIELDS[floor(hash(floor(gx / 40 + 60), floor(gz / 22)) * 5)];
      const e = ((x - TX) / 11) ** 2 + ((y - GL) / 3.6) ** 2;
      if (e < 1) c = e < 0.07 ? [245, 245, 245] : [204, 182, 132].map((v) => v * (e > 0.6 ? 0.84 : 1));
      c = lit(c).map((v, j) => mix(v, hor[j], exp(-(zf - 2) / 4) * 0.65));
    }
    // The hangar by the runway, its door open.
    if (x >= 3 && x <= 16 && y <= 105 && y >= 97 + ((x - 9.5) / 6.5) ** 2 * 3) c = lit(x > 6 && x < 13 && y > 100 ? [34, 34, 42] : [196, 196, 204], y < 99 ? 1.08 : 1);
    B[o] = c[0];
    B[o + 1] = c[1];
    B[o + 2] = c[2];
  }
}

// The far cumulus sitting on the horizon haze.
function farClouds(P) {
  const lt = KC(12), sh = KC(15), hor = KC(6);
  for (let x = 0; x < W; x++) {
    const xx = x * 0.9 + P.cx * 0.6 + 40, i = floor(xx), f = xx - i, hgt = mix(P.far[i & 127], P.far[(i + 1) & 127], f);
    for (let y = floor(98 - hgt); y <= 98; y++) {
      const u = (98 - y) / max(1, hgt), c = sh.map((v, j) => mix(mix(v, lt[j], cl(u * 1.3, 0, 1)), hor[j], 0.35));
      put(x, y, c, cl(y - (98 - hgt) + 0.5, 0, 1) * 0.92);
    }
  }
}

// The deck the divers fall through: domes on top, a flat grey base.
function deck(P) {
  const lt = KC(12), sh = KC(15);
  for (let x = 0; x < W; x++) {
    const xx = x + P.cx + 7, i = floor(xx), f = xx - i, hgt = mix(P.top[i & 127], P.top[(i + 1) & 127], f);
    if (hgt < 0.3) continue;
    for (let y = floor(DB - hgt); y <= DB; y++) {
      const u = (DB - y) / max(1, hgt), b = cl(u * 1.15 + (vn(xx * 0.35, y * 0.4) - 0.5) * 0.6, 0, 1);
      put(x, y, sh.map((v, j) => mix(v, lt[j], b)), cl(y - (DB - hgt) + 0.5, 0, 1) * (y === DB ? 0.7 : 0.95));
    }
  }
}

function plane(P, L) {
  const { len, dir, px } = L, X = (u) => px - dir * (len - u), body = lit([236, 236, 242]), belly = lit([168, 170, 180]), glass = lit([50, 74, 110]), dark = [22, 22, 28];
  for (let u = -1; u <= len; u += 0.5) {
    const x = X(u);
    if (u < 4.5) for (let y = PY - 2 - (u < 2 ? 5 : 5 - (u - 2) * 2); y < PY - 2; y++) put(x, y, body);
    if (u < 3.5) put(x, PY - 1, belly);
    if (u < 1) continue;
    const bot = u < 7 ? PY + 1 - (7 - u) * 0.45 : PY + 1, top = u > len - 3 ? PY - 2 + (u - len + 3) * 0.7 : PY - 2;
    for (let y = ceil(top); y <= bot; y++) put(x, y, y === PY ? lit(L.sc) : y > PY ? belly : body);
  }
  for (let u = 9; u < len - 5; u += 2) put(X(u), PY - 1, glass);
  put(X(len - 2), PY - 1, glass), put(X(len - 3), PY - 1, glass);
  for (let u = len * 0.42; u <= len * 0.66; u += 0.5) put(X(u), PY - 3, lit([214, 216, 224]));
  for (let u = len * 0.6; u <= len * 0.74; u += 0.5) put(X(u), PY - 2, lit([150, 150, 160]));
  for (let y = PY - 5; y <= PY; y++) put(X(len * 0.77), y, [220, 220, 230], 0.25 + 0.2 * rnd());
  put(X(len * 0.55), PY + 2, dark), put(X(len - 2), PY + 2, dark);
  // The door is open on the run in, with the next diver crouched in it.
  const next = L.d.find((D) => !D.st);
  if (next && L.t > L.te0 - 1.6) {
    for (let u = 4.5; u <= 6.5; u += 0.5) for (let y = PY - 1; y <= PY + 1; y++) put(X(u), y, dark);
    put(X(6), PY, lit(SUIT[next.suit])), put(X(6), PY - 1, lit(HELM[next.helm]));
  }
  if ((P.rt * 1.4) % 1 < 0.25) put(X(len * 0.5), PY - 4, [255, 40, 30]);
}

// A diver in freefall seen from above and behind: spread arms and legs, the rig on the back, the helmet.
const bp = (D, a, b) => {
  const c = cos(D.h) * 1.3, s = sin(D.h) * 1.3;
  return [D.x + c * a - s * b, D.y + (D.z + s * a + c * b) * ZS];
};
function diver(D) {
  const sc = lit(SUIT[D.suit]), ln = (a, b) => seg(...bp(D, ...a), ...bp(D, ...b), sc);
  for (const m of [-1, 1]) {
    ln([-0.9, 0.4 * m], [-2.8, 1.6 * m]);
    if (D.g < 0.97) ln([0.9, 0.8 * m], [2.1, 2.3 * m]);
  }
  ln([-0.9, 0], [0.9, 0]), ln([0.9, -0.9], [0.9, 0.9]);
  put(...bp(D, -0.1, 0), [26, 26, 32]);
  put(...bp(D, 1.9, 0), lit(HELM[D.helm]));
}

// A canopy: cells, lines, the jumper in the harness. On the ground it falls in behind the jumper, who gathers it up.
function canopy(D, T) {
  const sx = D.x, sy = D.y + D.z * ZS, ca = CAN[D.can], cb = CAN[D.cb], down = D.st === 4, sl = down ? T - D.tl : 0, a = 1 - sm(5.5, 7.5, sl);
  const suit = lit(SUIT[D.suit]);
  if (!down && D.o < 0.3) {
    // Pilot chute and bag going up.
    seg(sx, sy - 1, sx, sy - 2 - D.o * 22, lit([200, 200, 210]), 0.5), put(sx, sy - 2 - D.o * 22, lit([245, 245, 245]));
    put(sx, sy - 1, lit(HELM[D.helm])), put(sx, sy, suit), put(sx + 1, sy, suit);
    return;
  }
  const kk = down ? 1 : sm(0.25, 0.8, D.o), pop = 1 + 0.18 * sin(PI * sm(0.55, 1, D.o)), c = sm(0, 1.2, sl);
  const ch = cos(D.h), shh = sin(D.h), zm = 1 + D.z * 0.015, hs = (1 + 5.2 * kk) * pop * mix(1, 0.75, c) * zm, lr = (2 + 6 * kk) * (1 - c) * zm + 0.5 * c;
  const ox = down ? -ch * 4 * c : 0, oy = down ? -shh * 4 * c * ZS : 0, cy = sy - 1.5 - lr + oy, droop = mix(1.1, 0.2, c) + D.fl * 0.6;
  const svx = -shh * hs, svy = ch * hs * ZC, fx = ch * 2 * zm, fy = shh * 2 * ZC * (1 - c);
  if (!down || c < 1) for (const t of [-0.9, -0.35, 0.35, 0.9]) seg(sx, sy - 1.5, sx + ox + svx * t, cy + svy * t + droop * t * t + 1, lit([210, 210, 220]), 0.3 * a);
  for (let pass = 0; pass < 2; pass++)
    for (let t = -1; t <= 1; t += 0.45 / hs) {
      const cell = min(8, floor((t + 1) * 4.5)), col = cell > 2 && cell < 6 ? cb : ca, k = (cell & 1 ? 0.8 : 1) * (pass ? 1 : 0.5) * (1.12 - 0.12 * pop);
      for (let q = -1; q <= 1; q += 0.5) put(sx + ox + svx * t + fx * q, cy + svy * t + fy * q + droop * t * t + (pass ? 0 : 1), lit(col, k * (0.92 + 0.08 * q)), a);
    }
  put(sx, sy - 2, lit(HELM[D.helm]), a), put(sx, sy - 1, suit, a), put(sx + (D.fl > 0.3 ? 1 : 0), sy, suit.map((v) => v * 0.7), a);
}

function sock(P) {
  const w = P.w, aw = abs(w), sx = w >= 0 ? 1 : -1;
  for (let y = 104; y <= 116; y++) put(WX, y, lit([200, 200, 206]));
  for (let u = 0; u <= 6; u += 0.5) {
    const x = WX + sx * u * (0.3 + 0.7 * aw), y = 104 + u * (1 - aw) * 0.85 + sin(P.rt * 9 - u) * 0.35 * aw, col = lit(floor(u / 1.5) & 1 ? [240, 240, 240] : [255, 110, 20]);
    put(x, y, col), u < 4 && put(x, y + 1, col, 0.8);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.h === undefined) return;
  F = P.f;
  const hh = P.h * 3, i0 = min(2, floor(hh));
  K = KEYS[i0].map((v, c) => mix(v, KEYS[i0 + 1][c], hh - i0));
  LT = KC(18);
  backdrop(P);
  F.set(P.bg);
  // Cloud shadows crossing the fields.
  for (let y = HZ; y < H; y++) {
    const zf = y - HZ + 2;
    for (let x = 0; x < W; x++) {
      const v = vn((((x - 32) * 24) / zf - P.cx * 1.1) * 0.035, (260 / zf) * 0.05), k = 1 - 0.5 * sm(0.45, 0.58, v), o = (y * W + x) * 3;
      (F[o] *= k), (F[o + 1] *= k), (F[o + 2] *= k);
    }
  }
  farClouds(P);
  sock(P);
  const A = [];
  for (const L of P.loads) for (const D of L.d) if (D.st === 4) canopy(D, L.t);
  for (const L of P.loads) if (L.px > -40 && L.px < 104) plane(P, L);
  for (const L of P.loads) for (const D of L.d) if (D.st && D.st < 4) A.push([D, L]);
  A.sort((a, b) => a[0].z - b[0].z);
  for (const [D, L] of A) {
    if (D.st === 3) canopy(D, L.t);
    else {
      diver(D);
      // Grips: the arms of two docked neighbours meet between them.
      const E = L.d[(D.i + 1) % L.n];
      if (D.st === 1 && E.st === 1 && D.g > 0.97 && E.g > 0.97) {
        const d2 = (u, v) => (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2, [a, b, c, e] = [bp(D, 0.9, -0.9), bp(D, 0.9, 0.9), bp(E, 0.9, -0.9), bp(E, 0.9, 0.9)];
        const p = d2(a, c) + d2(a, e) < d2(b, c) + d2(b, e) ? a : b, q = d2(p, c) < d2(p, e) ? c : e;
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        seg(...p, ...m, lit(SUIT[D.suit])), seg(...m, ...q, lit(SUIT[E.suit]));
      }
    }
  }
  deck(P);
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
