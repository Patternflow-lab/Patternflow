// ===== Patternflow pattern =====
// Title:   Tower Crane
// Family:  construction
// Idea:    A yellow tower crane hoists a precast wall, rebar, formwork and the concrete bucket from the yard to the top deck of a concrete frame going up at dusk, slewing its jib round in perspective, and each pour adds a floor.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the tower cranes that stand beside a rising concrete frame
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Dusk=0..1, Speed=0.2..3, Floors=9..13, Wind=-1..1
//
// Knob 1: Dusk. From late afternoon at 0, the sun low over the yard and the frame lit gold, to night at 1, when the sky goes navy, the floodlight and the trolley's lamp come on and most windows are lit.
// Knob 2: Speed. At 2 one lift takes about ten seconds: down to the yard, rig, hoist the whole height, slew over and set down. At 0.2 it all runs ten times slower.
// Knob 3: Floors. How many floors are up when it starts, nine to thirteen. Every fourth lift is the concrete bucket, and its pour adds a floor until the frame has thirteen and tops out with a fir tree on the roof.
// Knob 4: Wind. Clouds thicken and drift with it either way, their shadows cross the frame, and the load leans and swings on its cable.
// Buttons: K1 tap sets the floor's formwork in place and pours the deck at once, and the building grows a floor.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, floor, round, sin, cos, abs, exp, PI } = Math;
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

// Street level, one storey, and the most floors that fit under the jib.
const [GY, FH, NMAX] = [114, 6, 13];
// The frame, x 3 to 39: six columns two LEDs wide, five bays, the one by the crane the lift core.
const [BX0, BX1, CORE] = [3, 39, 4];
// Mast centre, the jib's bottom chord at the root, jib and counter-jib lengths, top of the tower head.
const [MX, JY, JL, CJL, APEX] = [46, 15, 42, 15, 3];
// The hook's highest row, the radius it picks at over the yard, the yard's load line.
const [HTOP, PICK_R, PICK_Y] = [21, 11, 120];
// Wall panel, rebar, formwork, bucket: width, height, the column it is set down on.
const LW = [8, 11, 9, 5], LH = [5, 2, 4, 6], DROP = [35, 20, 12, 6];
// Sky top, middle, horizon; sun; lit and shaded cloud; light on things. Afternoon to night.
const KEYS = [
  [34, 72, 156, 128, 142, 186, 255, 190, 112, 255, 236, 170, 255, 236, 204, 150, 130, 160, 1, 0.9, 0.74],
  [30, 50, 130, 168, 108, 140, 255, 140, 62, 255, 168, 78, 255, 170, 116, 104, 70, 108, 0.86, 0.64, 0.48],
  [16, 20, 70, 64, 44, 96, 196, 86, 78, 226, 90, 52, 176, 92, 104, 46, 36, 66, 0.44, 0.38, 0.46],
  [4, 6, 22, 10, 14, 40, 44, 34, 60, 0, 0, 0, 42, 36, 56, 16, 16, 30, 0.2, 0.21, 0.3],
];
const FLC = [1, 0.94, 0.82];
const YEL = [255, 196, 22];
// The floodlight tower in the yard and where it is aimed.
const [LX, LY] = [60.5, 84.5];
const [AX, AY] = (([x, y]) => [x / Math.hypot(x, y), y / Math.hypot(x, y)])([-34, 31]);

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const P = (params.s = {
    f: F(N * 3), bg: F(N * 3), lm: F(N * 3), fl: F(N), row: F(H * 3), cloud: F(128 * 64), sky: new Int16Array(W),
    t: 0, rt: 0, nk: -1, stage: 3, cage: 1, form: 1, item: -1, lightNew: -1, th: PI, r: 40, load: 3, ph: "I", sw: 0, swv: 0, vx: 0, ptx: 6,
    on: new Uint8Array(NMAX), onT: F(NMAX).fill(9), nsw: 2.4, cx: 0, sp: [], weld: 0.4, welding: 0, wk: [], mix: 2, cars: [], ncar: 1.4,
  });
  // Clouds: a strip of soft noise that wraps every 128 columns.
  for (let i = 0; i < 128 * 64; i++) {
    const x = i & 127, y = i >> 7, f = (X) => 0.55 * vn(X * 0.05, y * 0.13) + 0.3 * vn(X * 0.13, y * 0.3 + 9) + 0.15 * vn(X * 0.4, y * 0.6 + 3);
    P.cloud[i] = mix(f(x), f(x + 128), x / 128);
  }
  // The city behind: blocks of four to nine columns.
  for (let x = 0, w = 0, h = 0; x < W; x++, w--) w > 0 || ((w = 4 + floor(rnd() * 6)), (h = 98 + floor(rnd() * 12))), (P.sky[x] = h);
  for (let k = 0; k < NMAX; k++) (P.on[k] = rnd() < 0.35 ? 1 : 0), k < 3 && P.wk.push({ x: 8 + k * 11 + rnd() * 4, tx: 8 + rnd() * 28, wait: rnd() * 2 });
}

// A move of the crane: slew angle, trolley radius and hook row, eased to where they go.
function go(P, ph, dur, to) {
  Object.assign(P, { ph, pt: 0, pd: dur, f0: [P.th, P.r, P.hy], f1: [to.th ?? P.th, to.r ?? P.r, to.hy ?? P.hy] });
}

const deckY = (P) => GY - P.n * FH;
const tip = (P) => [MX + P.r * cos(P.th), JY + 1 - P.r * sin(P.th) * 0.1];
const bucketHy = (P) => deckY(P) - FH - 2 - LH[3] - 3;

function finishFloor(P) {
  if (P.n < NMAX) P.n++;
  else P.top = 1;
  // The floor that has just been glazed lights up a moment later.
  Object.assign(P, { stage: 0, cage: 0, form: 0, item: -1, pourX: -1, nsw: min(P.nsw, 0.7), lightNew: P.n - 3 });
}

// Down to the yard, rig, hoist, slew over, lower, set down (or pour), up again.
function step(P) {
  const T = P.ph, type = P.load;
  if (T === "A") go(P, "B", 0.5, {});
  else if (T === "B") (P.load = P.top && P.stage > 2 ? (P.stage = 0) : P.stage), go(P, "C", 2.8, { hy: HTOP });
  else if (T === "C") go(P, "D", 2.4, { th: P.th + PI, r: MX - DROP[type] });
  else if (T === "D") go(P, "E", 1.5, { hy: type === 3 ? bucketHy(P) : deckY(P) - 4 - LH[type] });
  else if (T === "E") {
    if (type === 3) (P.pourX = BX0), go(P, "P", 3, { r: MX - BX1 + 2 });
    else {
      // Set down: the panel goes into the core, rebar and formwork lie on the deck.
      const x = round(tip(P)[0]);
      if (type) (P.item = type), (P.ix = x), type < 2 ? (P.cage = 0) : (P.form = 0);
      for (const w of P.wk) w.tx = x + (rnd() - 0.5) * 10;
      (P.stage = max(P.stage, type + 1)), (P.load = -1), go(P, "F", 0.9, {});
    }
  } else if (T === "P" || T === "I") finishFloor(P), go(P, "F", 0.4, {});
  else if (T === "F") go(P, "G", 0.5, { hy: P.hy - 12 });
  else (P.load = -1), go(P, "A", 1.5, { th: (floor(P.th / TAU + 1e-3) + 1) * TAU, r: PICK_R, hy: PICK_Y - LH[P.stage] - 3 });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], rd = cl(dt || 0, 0, 0.1), d = rd * (cl(k[1], 0.2, 3) / 2), nf = round(cl(k[2], 9, 13));
  if (nf !== P.nk) {
    // A new count of floors: the hook keeps its place over the deck.
    const sh = (nf - P.n) * FH;
    P.nk = P.n = nf;
    P.top = 0;
    if (P.ph === "I") (P.hy = bucketHy(P)), (P.pourX = BX0), go(P, "I", 3, { r: MX - BX1 + 2 });
    else if ("EPFG".includes(P.ph)) (P.hy -= sh), (P.f0[2] -= sh), (P.f1[2] -= sh);
  }
  P.w = cl(k[3], -1, 1);
  const t = (P.t += d), k0 = cl(k[0], 0, 1);
  P.rt += rd;
  // The evening deepens a little and comes back once every minute and a half.
  P.h = k0 + (1 - k0) * 0.05 * (1 - cos((TAU * t) / 90));
  // K1 tap: everything for the floor is in place at once and the deck pours.
  if (input.btnPressed && input.btnPressed[0] && P.pourX < 0 && !P.top) Object.assign(P, { pourBtn: 1, pourX: BX0, stage: 3, cage: 1, form: 1 });
  const lin = min(1, (P.pt += d) / P.pd), u = sm(0, 1, lin), pour = P.ph === "P" || P.ph === "I";
  P.th = mix(P.f0[0], P.f1[0], u);
  P.r = mix(P.f0[1], P.f1[1], pour ? lin : u);
  P.hy = mix(P.f0[2], P.f1[2], u);
  if (pour) P.pourX = max(P.pourX, tip(P)[0] + 2);
  if (lin >= 1) step(P);
  if (P.pourBtn && (P.pourX += 30 * d) > BX1) (P.pourBtn = 0), finishFloor(P);
  // The load swings on its cable when the trolley speeds up or slows, and in the wind.
  const [tx, ty] = tip(P), L = max(4, P.hy - ty);
  if (d > 0) {
    const vx = (tx - P.ptx) / d, ax = cl((vx - P.vx) / d, -30, 30), eq = P.w * (0.06 + 0.04 * sin(t * 1.7)) * (P.load >= 0 ? 1 : 1.6);
    P.swv += (-(110 / L) * (P.sw - eq) - (0.5 * ax) / L - 1.4 * P.swv) * d;
    P.sw = cl(P.sw + P.swv * d, -0.3, 0.3);
    [P.ptx, P.vx] = [tx, vx];
  }
  // The rigger steadies the load before it goes up.
  if (P.ph === "B") (P.sw *= 1 - min(1, 5 * d)), (P.swv *= 1 - min(1, 5 * d));
  P.swx = cl(L * sin(P.sw), -2.5, 2.5);
  // The rebar is tied up the columns and the formwork goes round them.
  if (P.stage > 1) P.cage = min(1, P.cage + d * 0.3);
  if (P.stage > 2) P.form = min(1, P.form + d * 0.3);
  // A floor switches its lights on or off together.
  for (let i = 0; i < NMAX; i++) P.onT[i] += rd;
  if ((P.nsw -= d) <= 0) {
    const f = P.lightNew >= 0 ? P.lightNew : floor(rnd() * max(1, P.n - 2));
    P.on[f] = P.lightNew >= 0 ? 1 : 1 - P.on[f];
    Object.assign(P, { lightNew: -1, nsw: 1.6 + rnd() * 2 }).onT[f] = 0;
  }
  // Welding on the deck, and its sparks falling down the face.
  if ((P.weld -= d) <= 0) (P.welding = 1 - P.welding), (P.weld = P.welding ? 1.4 + rnd() * 1.6 : 0.4 + rnd() * 0.8);
  const wy = deckY(P) - 2;
  if (P.welding) for (let n = 0; n < 4; n++) if (rnd() < d * 18) P.sp.push([18 + rnd(), wy, (rnd() - 0.5) * 14, -4 - rnd() * 7, 1 + rnd() * 0.9, 18.5, wy]);
  P.sp = P.sp.filter((s) => ((s[5] = s[0]), (s[6] = s[1]), (s[3] += 46 * d), (s[0] += s[2] * d), (s[1] += s[3] * d), (s[4] -= d) > 0 && s[1] < GY));
  // Workers walk about the deck.
  for (const w of P.wk)
    if (abs(w.tx - w.x) > 0.3) w.x = cl(w.x + cl(w.tx - w.x, -4 * d, 4 * d), 5, 37);
    else if ((w.wait -= d) <= 0) (w.tx = 6 + rnd() * 30), (w.wait = 1 + rnd() * 3);
  // The mixer comes in for the bucket and backs out after the pour.
  P.mix += cl((P.stage >= 2 && !P.top ? 2 : -26) - P.mix, -9 * d, 9 * d);
  // Cars along the street.
  if ((P.ncar -= d) <= 0) (P.ncar = 2 + rnd() * 4), P.cars.push(rnd() < 0.5 ? [-8, 11 + rnd() * 6, floor(rnd() * 4)] : [W + 1, -11 - rnd() * 6, floor(rnd() * 4)]);
  P.cars = P.cars.filter((c) => ((c[0] += c[1] * d), c[0] > -12 && c[0] < W + 12));
  // Clouds drift with the wind.
  P.cx += (1.5 + 9 * P.w) * d;
}

let F, LM;
const at = (x, y) => ((x = round(x)), (y = round(y)), x < 0 || x >= W || y < 0 || y >= H ? -1 : (y * W + x) * 3);
function put(x, y, c, a = 1, o = at(x, y)) {
  if (o >= 0) for (let i = 0; i < 3; i++) F[o + i] = mix(F[o + i], c[i], a);
}
function add(x, y, c, k, o = at(x, y)) {
  if (o >= 0) for (let i = 0; i < 3; i++) F[o + i] += c[i] * k;
}
// A surface: its own colour under the light that falls on that LED.
function sur(x, y, r, g, b, k = 1, o = at(x, y)) {
  if (o >= 0) (F[o] = r * LM[o] * k), (F[o + 1] = g * LM[o + 1] * k), (F[o + 2] = b * LM[o + 2] * k);
}
const surc = (x, y, c, k = 1) => sur(x, y, c[0], c[1], c[2], k);
// A lamp's glow round it, and a worker three LEDs tall.
const glow = (x, y, c, k) => {
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i || j) add(x + i, y + j, c, k / (i * i + j * j));
};
const man = (x, y, head = [250, 250, 240]) => (sur(x, y, 50, 56, 90), sur(x, y - 1, 255, 130, 20), surc(x, y - 2, head));
function line(x0, y0, x1, y1, c, k = 1) {
  const n = max(abs(x1 - x0), abs(y1 - y0)) * 1.2 + 1;
  for (let i = 0; i <= n; i++) surc(mix(x0, x1, i / n), mix(y0, y1, i / n), c, k);
}

// Sky, sun and the city beyond, kept until the evening moves on.
function sky(P, K) {
  const h = P.h, B = P.bg;
  if (round(h * 300) === P.bgKey) return F.set(B);
  P.bgKey = round(h * 300);
  const row = P.row, night = sm(0.4, 0.9, h), vis = 1 - sm(0.78, 0.95, h);
  for (let y = 0; y < H; y++) {
    const f = min(1, y / GY), a = f < 0.5 ? 0 : 3, u = f < 0.5 ? f / 0.5 : (f - 0.5) / 0.5;
    for (let c = 0; c < 3; c++) row[y * 3 + c] = mix(K[a + c], K[a + 3 + c], a ? u * u : sm(0, 1, u));
  }
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3;
    if (y >= P.sky[x]) {
      const win = night * (hash(x, y * 3) < 0.16 && y & 1 ? 1 : 0);
      for (let c = 0; c < 3; c++) B[o + c] = mix(K[3 + c], K[6 + c], 0.55) * 0.6 * (x & 1 ? 1 : 0.86) + win * [210, 160, 90][c];
      continue;
    }
    const d = Math.hypot(x - 54.5, y - 61.5 - 52 * h), g = vis * (0.55 * exp(-((d - 3.6) ** 2) / 50) + 0.3 * exp(-d / 16));
    for (let c = 0; c < 3; c++) B[o + c] = d < 3.6 && vis > 0 ? mix(row[y * 3 + c], K[9 + c], vis) : row[y * 3 + c] + K[9 + c] * g * 0.7;
  }
  F.set(B);
}

function clouds(P, K) {
  const cover = 0.56 - 0.18 * abs(P.w), C = P.cloud;
  for (let y = 0; y < 100; y++) {
    const ty = floor(y * 0.6) & 63, fade = 1 - sm(50, 100, y);
    for (let x = 0; x < W; x++) {
      if (y >= P.sky[x]) continue;
      const v = C[(ty << 7) | (floor(x + P.cx) & 127)], a = cl((v - cover) * 7, 0, 1) * fade, lt = cl(1.25 - (v - cover) * 4 + (y - 40) / 120, 0, 1);
      if (a > 0.01) put(x, y, [mix(K[15], K[12], lt), mix(K[16], K[13], lt), mix(K[17], K[14], lt)], a * 0.92);
    }
  }
}

// The light on every surface: the day, cloud shadows, the floodlights after dusk.
function light(P, K) {
  const sunA = 1 - sm(0.45, 0.85, P.h), fon = sm(0.3, 0.55, P.h), FLb = P.fl, C = P.cloud;
  const cover = 0.5 - 0.18 * abs(P.w), [tx, ty] = tip(P), hx = tx + P.swx * 0.5;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, v = C[((floor(y * 0.25 + 20) & 63) << 7) | (floor(x * 0.8 + P.cx * 2.2 + 40) & 127)];
    let fl = 0;
    if (fon > 0) {
      const dx = x + 0.5 - LX, dy = y + 0.5 - LY, dd = Math.hypot(dx, dy) + 0.01, ca = (dx * AX + dy * AY) / dd;
      fl = (exp((ca - 1) / 0.03) * 1.2) / (1 + (dd / 60) ** 2);
      if (y > ty + 1) {
        const q = (x + 0.5 - hx) / (1.2 + 0.16 * (y - ty));
        fl += (exp(-q * q) * 0.7) / (1 + ((y - ty) / 90) ** 2);
      }
      fl *= fon;
    }
    FLb[i] = fl;
    for (let c = 0; c < 3; c++) LM[o + c] = K[18 + c] * (1 - 0.45 * sunA * cl((v - cover) * 5, 0, 1)) + fl * FLC[c];
  }
}

// The yard's gravel, the kerb, the street and its markings.
function ground() {
  for (let i = GY * W; i < N; i++) {
    const x = i & 63, y = i >> 6, n = 0.82 + 0.3 * hash(x, y + 900);
    y === 126 && (x + 6) % 8 < 2 ? sur(x, y, 190, 180, 120) : y > 123 ? sur(x, y, 62 * n, 60 * n, 66 * n) : y > 122 ? sur(x, y, 150, 146, 140) : sur(x, y, 150 * n, 126 * n, 98 * n);
  }
}

// The concrete frame, its windows, and the floor going up on the deck.
function building(P) {
  const n = P.n, dk = deckY(P), g = n - 2, night = sm(0.4, 0.9, P.h), row = P.row;
  for (let y = dk; y < GY; y++) {
    const k = floor((GY - 1 - y) / FH), ry = y - (GY - (k + 1) * FH);
    for (let x = BX0; x <= BX1; x++) {
      const cx = (x - BX0) % 7, b = floor((x - BX0) / 7), bx = cx - 2;
      if (ry === 0) sur(x, y, 228, 220, 206);
      else if (cx < 2) sur(x, y, 206, 198, 184);
      else if (ry === 1) k < g ? sur(x, y, 78, 86, 102) : sur(x, y, 178, 172, 162);
      else if (b === CORE) sur(x, y, 196, 190, 180, (x + y) % 9 === 0 ? 0.8 : 0.95);
      else if (k < g && bx === 2) sur(x, y, 80, 80, 88);
      else if (k < g) {
        // Glass: the sky in it, or a lit room behind.
        const o = (y * W + x) * 3, rr = cl(round(y * 0.3 + 4), 0, GY - 1) * 3;
        let on = P.on[k] ? hash(k, b * 7 + 1) < 0.92 : hash(k, b * 7 + 3) < 0.1 + 0.6 * night;
        if (on && P.on[k] && P.onT[k] < 0.5) on = hash(k * 13 + b, floor(P.onT[k] * 22)) > 0.45;
        const lc = hash(k, b + 40) < 0.75 ? [255, 184, 88] : [200, 228, 255], a = on ? 0.9 + 0.1 * night : 0;
        for (let c = 0; c < 3; c++) F[o + c] = mix(row[rr + c] * 0.42 + c * 5, lc[c], a) * (ry === 2 ? 1.12 : 1);
      } else {
        // An open floor: dark inside, the back columns, a work lamp at night.
        if (night > 0.05 && bx === 2 && ry === 2 && hash(k, b) < 0.6) put(x, y, [255, 214, 150].map((v) => v * night));
        else sur(x, y, 60, 54, 52, bx === 2 ? 0.6 : 0.28);
      }
    }
  }
  // Ties from the mast to the frame.
  for (let k = 2; k < n; k += 3) for (let x = BX1 + 1; x < MX - 2; x++) sur(x, GY - (k + 1) * FH + 1, 200, 170, 60);

  // The floor on the deck: starter bars, the core panel, the rebar cages, the formwork.
  const top = dk - FH, st = P.top ? 0 : P.stage;
  if (st > 0) for (let y = top + 1; y < dk; y++) for (let x = BX0 + 30; x <= BX0 + 34; x++) sur(x, y, 176, 172, 164, x === BX0 + 32 ? 0.8 : 1);
  for (let ci = 0; ci < 6; ci++) {
    const x = BX0 + ci * 7;
    for (let j = 1; j <= max(2, st > 1 ? round(P.cage * 5) : 0); j++) sur(x, dk - j, 176, 96, 50), j & 1 && sur(x + 1, dk - j, 130, 76, 44);
    if (st > 2 && ci / 6 < P.form) for (let j = 1; j < FH; j++) sur(x, dk - j, 218, 162, 84), sur(x + 1, dk - j, 196, 140, 70);
  }
  if (st > 2) for (let x = BX0; x <= BX0 + 36 * P.form; x++) for (let j = 0; j < ((x - BX0) % 7 === 4 ? FH : 1); j++) j ? sur(x, top + j, 150, 150, 156, 0.8) : sur(x, top, 214, 156, 80);
  if (P.pourX >= 0 && !P.top) for (let x = BX0; x <= min(BX1, P.pourX); x++) sur(x, top, 140, 140, 150), (x - BX0) % 7 < 2 && sur(x, top + 1, 140, 140, 150, 0.9);
  if (P.item > 0) drawLoad(P.item, P.ix, dk - LH[P.item]);
  // Topped out: a little fir tree on the roof.
  if (P.top) for (let j = 0; j < 5; j++) for (let i = -j; i <= j; i++) sur(24 + i, dk - 6 + j, 40, 120, 60);
  // The workers on the deck in hi-vis, and the welder by a column.
  for (const w of P.wk) man(w.x, dk - 1);
  man(17, dk - 1, [60, 60, 70]);
}

// One of the four loads, centred on x with its top on row y0.
function drawLoad(type, cx, y0) {
  const w = LW[type], h = LH[type], x0 = round(cx - w / 2), y = round(y0);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const X = x0 + i, Y = y + j;
      if (type === 0) (i < 2 || i > 4 || !j || j > 3) && sur(X, Y, 150, 146, 140, i && j ? 1 : 1.25);
      else if (type === 1) sur(X, Y, i === 2 || i === 8 ? 60 : 186, i === 2 || i === 8 ? 54 : 92, 48, j ? 0.72 : 1);
      else if (type === 2) sur(X, Y, 226, 170, 92, j & 1 ? 0.55 : 1);
      else if (i >= (j >= h - 2 ? 1 : 0) && i < w - (j >= h - 2 ? 1 : 0)) sur(X, Y, 120, 120, 128, j === 1 ? 0.6 : j === 0 ? 1.3 : 1);
    }
  if (type === 3) sur(x0 + 2, y + h, 70, 70, 76);
}

// The hook block, its cable and slings, and whatever it carries.
function hook(P) {
  const [tx, ty] = tip(P), hx = tx + P.swx, hy = P.hy;
  line(tx, ty + 1, hx, hy - 1, [120, 120, 130], 0.9);
  for (let i = -1; i <= 1; i++) surc(hx + i, hy - 1, YEL);
  sur(hx, hy, 60, 60, 66), sur(hx, hy + 1, 90, 90, 96);
  if (P.load >= 0) {
    const w = LW[P.load] / 2 - 0.5;
    line(hx, hy + 1, hx - w, hy + 3, [110, 110, 116], 0.8), line(hx, hy + 1, hx + w, hy + 3, [110, 110, 116], 0.8);
    drawLoad(P.load, hx + 0.5, hy + 3);
    // Concrete runs from the bucket into the forms.
    if (P.ph === "P" || P.ph === "I") for (let j = hy + 10; j < deckY(P) - FH; j++) sur(hx + 0.5, j, 140, 140, 150);
  }
}

// The yard: stock waiting by the crane, the load being rigged, the floodlight tower.
function yard(P) {
  drawLoad(2, 53, 115), drawLoad(1, 54, 118);
  if (P.ph === "A" || P.ph === "B") {
    const s = P.stage, x = MX + PICK_R - LW[s] / 2 - 2, arm = P.ph === "B" ? (P.pt * 6) & 1 : 0;
    drawLoad(s, MX + PICK_R + 0.5, PICK_Y - LH[s]);
    man(x, PICK_Y - 1), sur(x + 1, PICK_Y - 2 - arm, 255, 130, 20);
  }
  for (let y = LY; y < 122; y++) sur(62, y, 120, 120, 126);
  const fon = sm(0.3, 0.55, P.h);
  for (let x = 59; x <= 62; x++) put(x, 83, [90, 90, 96]), put(x, 84, x < 62 ? [70 + 185 * fon, 70 + 180 * fon, 76 + 154 * fon] : [90, 90, 96]);
}

// The crane: mast, ties, slewing ring, cab, tower head, jib and counter-jib.
function crane(P) {
  const c = cos(P.th), sn = sin(P.th), blink = P.rt % 1.2 < 0.55, fon = sm(0.3, 0.55, P.h);
  const jib = () => {
    for (let s = 0; s <= JL; s += 0.3) {
      // Swung towards you the tip is nearer and bigger, swung away it shrinks.
      const sc = 1 + (0.45 * s * sn) / JL, px = MX + s * c, py = JY - s * sn * 0.1, ht = (3 - (1.2 * s) / JL) * sc, tri = abs(((s / 2.4) % 2) - 1), wd = sn * 1.2 * sc;
      surc(px - wd, py, YEL, 0.85), surc(px + wd, py, YEL, 0.85), surc(px, py - ht, YEL), surc(px + wd * (1 - tri), py - tri * ht, YEL, 0.75);
    }
  };
  const counter = () => {
    for (let s = 0; s <= CJL; s += 0.3) {
      const px = MX - s * c, py = JY + s * sn * 0.1;
      surc(px, py, YEL, 0.85), surc(px, py - 1, YEL, s % 2 < 0.6 ? 0.8 : 0);
      if (s > 6 && s < 8.5) for (let j = 1; j <= 2; j++) sur(px, py - 1 - j, 80, 84, 92);
      if (s > CJL - 5) for (let j = 1; j <= 4; j++) sur(px, py + j, 190, 184, 172, (floor(s) & 1) === 0 ? 0.8 : 1);
    }
  };
  const pend = () => {
    line(MX, APEX + 1, MX + 28 * c, JY - 28 * sn * 0.1 - 2.2, [110, 104, 96], 0.8);
    line(MX, APEX + 1, MX - CJL * c, JY + CJL * sn * 0.1 - 1, [110, 104, 96], 0.8);
  };
  const cab = () => {
    for (let q = 0, i, j; q < 12; q++)
      (i = (q % 3) - 1), (j = (q / 3) | 0), j % 3 && i > -1 ? put(MX + 3.5 * c + i, JY + 1 + j, P.h > 0.5 ? [255 * fon, 226 * fon, 160 * fon] : [110, 150, 196]) : surc(MX + 3.5 * c + i, JY + 1 + j, [240, 232, 210]);
  };
  // What faces away is drawn first.
  if (sn < 0) jib(), pend(), cab();
  else counter(), pend();
  // The mast: two chords and a lattice of diagonals.
  for (let y = JY + 3; y < 118; y++) {
    surc(MX - 2, y, YEL, 0.72), surc(MX + 2, y, YEL);
    for (let xi = 1; xi <= 3; xi++) if (((y + xi) & 3) === 0 || ((y - xi) & 3) === 0) surc(MX - 2 + xi, y, YEL, 0.8);
  }
  for (let x = MX - 4; x <= MX + 4; x++) sur(x, 117, 170, 166, 160), sur(x, 118, 170, 166, 160), sur(x, 119, 170, 166, 160), abs(x - MX) < 4 && (sur(x, JY + 1, 80, 80, 86), sur(x, JY + 2, 110, 110, 116));
  // The tower head.
  for (let y = APEX; y <= JY - 3; y++) {
    const hw = (1.6 * (y - APEX)) / (JY - 3 - APEX);
    surc(MX - hw, y, YEL), surc(MX + hw, y, YEL);
    if ((y & 1) === 0) for (let x = round(MX - hw); x <= MX + hw; x++) surc(x, y, YEL, 0.8);
  }
  if (sn < 0) counter(), pend();
  else jib(), pend(), cab();
  // The trolley, and the warning lights on the head and at the jib tip.
  const [tx, ty] = tip(P);
  sur(tx - 1, ty, 90, 90, 96), sur(tx, ty, 90, 90, 96), sur(tx + 1, ty, 90, 90, 96);
  for (const [x, y] of [[MX, APEX - 1], [MX + JL * c, JY - JL * sn * 0.1 - 2]]) {
    put(x, y, blink ? [255, 40, 28] : [110, 20, 16]);
    if (blink) glow(x, y, [255, 30, 20], 0.12 + 0.3 * fon);
  }
}

// The mixer, its drum turning.
function mixer(P) {
  const x0 = round(P.mix), night = sm(0.4, 0.9, P.h);
  if (x0 < -24) return;
  for (let y = 115; y <= 121; y++)
    for (let i = 0; i < 13; i++) {
      const e = ((i - 6) / 6.8) ** 2 + ((y - 118 + (i - 6) * 0.18) / 3.4) ** 2;
      if (e < 1) sur(x0 + i, y, ...((((i * 0.7 + y * 1.4 - P.t * 9) % 4) + 4) % 4 < 2 ? [240, 120, 40] : [230, 228, 220]), 1 - 0.3 * e);
    }
  for (let i = 0; i < 20; i++) sur(x0 + i, 122, 70, 70, 76);
  for (let y = 116; y < 122; y++) for (let i = 15; i < 20; i++) sur(x0 + i, y, ...(y < 119 && i > 16 ? [110, 150, 190] : [230, 60, 40]));
  for (const i of [2, 5, 16]) sur(x0 + i, 123, 30, 30, 34), sur(x0 + i + 1, 123, 30, 30, 34);
  if (night > 0.1) add(x0 + 20, 120, [255, 240, 200], night);
}

function cars(P) {
  const night = sm(0.35, 0.9, P.h), cols = [[200, 40, 36], [220, 220, 226], [40, 80, 170], [60, 64, 70]];
  for (const [cx, v, ci] of P.cars) {
    const x0 = round(cx), fx = v > 0 ? x0 + 6 : x0;
    for (let i = 0; i < 21; i++) i < 14 ? surc(x0 + (i >> 1), 125 + (i & 1), cols[ci]) : i < 17 && sur(x0 + i - 12, 124, 120, 150, 180);
    add(fx, 125, [255, 250, 220], 0.3 + night), add(x0 + 6 - fx + x0, 125, [255, 20, 10], 0.2 + night);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.h === undefined) return;
  [F, LM] = [P.f, P.lm];
  const hh = cl(P.h, 0, 1) * 3, i0 = min(2, floor(hh)), K = KEYS[i0].map((v, c) => mix(v, KEYS[i0 + 1][c], hh - i0));
  // The hook goes behind the frame when the jib swings away from you.
  const behind = sin(P.th) < -0.15, y = deckY(P) - 2, FLb = P.fl;
  sky(P, K), clouds(P, K), light(P, K), ground(), behind && hook(P), building(P), yard(P), crane(P), mixer(P), cars(P), behind || hook(P);
  // The welding arc, its sparks, and the floodlight beams in the dusk air.
  if (P.welding) put(18, y, [235, 244, 255]), glow(18, y, [160, 190, 255], 0.36 + 0.24 * rnd());
  for (const [x, y, , , l, px, py] of P.sp) put(px, py, [255, 120, 30], min(1, l * 1.4) * 0.6), put(x, y, [255, 170 + 80 * min(1, l), 70 * min(1, l)], min(1, l * 1.4));
  if (P.h > 0.3) for (let i = 0, o = 0; i < N; i++, o += 3) if (FLb[i] > 0.01) for (let c = 0; c < 3; c++) F[o + c] += FLb[i] * 22 * FLC[c];
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
