// ===== Patternflow pattern =====
// Title:   Sheet Mask
// Family:  cosmetic
// Idea:    A serum-soaked sheet mask with a fine fibre texture is laid over a pearly skin-toned ground from the top of the panel down, wetting through to a translucent tint as it touches and trapping air in pillowy white blisters with a bright rim, until an unseen palm sweeps down and squeezes every blister sideways out at the panel's edges, leaving the sheet flat and glossy with the serum's sheen sliding under a moving light, and then the sheet lifts away and a new one comes down.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 35, after a cellulose sheet mask smoothed onto the face; the reverse of Peel-Off
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bubbles=6..20, Weave=0..1
//
// Knob 1: Hue. The serum's tint in the wet sheet, once round the wheel from aqua at 0: periwinkle at 0.1, orchid at 0.3, rose at 0.45, peach at 0.58, nude at 0.63, butter at 0.7, spring green at 0.78, mint at 0.9. From coral round to lime the tint is paler and the wet sheet lighter, because at the aqua's depth those hues read as tan and olive.
// Knob 2: Speed. At 2 the sheet's hem reaches the bottom in 1.7 seconds and the sheet has soaked through by 2.6; the blisters sit for 1, the palm takes 4.2 to sweep down, the flat sheet shines for 3, lifts off in 1.4 and the skin shows bare for 0.7, 13 seconds a round. At 0.2 all of it runs ten times slower.
// Knob 3: Bubbles. How much air the sheet traps as it settles: 6 blisters 7 to 16 LEDs across at the opening, up to 20 of them 10 to 23 across, and the more air, the more milky half-touching patches the sheet shows until the palm presses them clear.
// Knob 4: Weave. The fabric. At 0 a fine nonwoven of cellulose fibres 3 to 5 LEDs long lying every which way; towards 1 the fibres grow to 11 to 21 LEDs, stand out more and line up across and along the panel into an open cotton gauze.
// Buttons: K1 tap presses the whole sheet down at once: the palm runs down the panel in 0.8 seconds and squirts every blister out at the sides. On a sheet already flat it lifts it off and lays a new one.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x2c1b3c6d, 0x297a2d39);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
// A generator of its own for the fabric, so turning Weave changes only the
// fabric and never where the next round's blisters land.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth noise in a 128 x 128 tile that wraps, octaves of 8, 16 and 32
// cells: the skin's contour under the sheet and the mottle of the fabric.
const T = 128, TM = T - 1, TEX = new Float32Array(T * T);
function buildTex() {
  let amp = 1, tot = 0;
  for (let o = 0; o < 3; o++) {
    const cells = 8 << o, size = T / cells, g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = hash(i * 13 + o * 7919) * 2 - 1;
    for (let y = 0; y < T; y++) {
      const gy = floor(y / size), fy = sm(y / size - gy), y1 = (gy + 1) % cells;
      for (let x = 0; x < T; x++) {
        const gx = floor(x / size), fx = sm(x / size - gx), x1 = (gx + 1) % cells;
        const a = g[gy * cells + gx], b = g[gy * cells + x1], c = g[y1 * cells + gx], d = g[y1 * cells + x1];
        const top = a + (b - a) * fx;
        TEX[y * T + x] += (top + (c + (d - c) * fx - top) * fy) * amp;
      }
    }
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < TEX.length; i++) TEX[i] /= tot;
}
function tap(u, v) {
  const fu = floor(u), fv = floor(v), x0 = fu & TM, y0 = fv & TM, x1 = (x0 + 1) & TM, y1 = (y0 + 1) & TM;
  const tx = u - fu, ty = v - fv;
  const a = TEX[y0 * T + x0], b = TEX[y0 * T + x1], c = TEX[y1 * T + x0], d = TEX[y1 * T + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

function hsv(h, s, v, out) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

// The fabric, one value an LED round 0.5, wrapping both ways: a cloudy
// mottle and short fibres laid in it. Weave makes the fibres longer and
// thicker and turns them towards the two directions of a woven gauze.
function weave(P, k) {
  const F = P.F, R = rng(90731), s = 1 + 3 * k, align = sm((k - 0.15) / 0.75), wd = 0.6 + 0.35 * (s - 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) F[y * W + x] = 0.5 * tap((x * 2) / s + 11, (y * 2) / s + 5);
  const splat = (fx, fy, a) => {
    const ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
    const x0 = ((ix % W) + W) % W, x1 = (x0 + 1) % W, y0 = ((iy % H) + H) % H, y1 = (y0 + 1) % H;
    F[y0 * W + x0] += a * (1 - tx) * (1 - ty);
    F[y0 * W + x1] += a * tx * (1 - ty);
    F[y1 * W + x0] += a * (1 - tx) * ty;
    F[y1 * W + x1] += a * tx * ty;
  };
  const n = floor(1500 / s);
  for (let i = 0; i < n; i++) {
    const x0 = R() * W, y0 = R() * H, len = (2.8 + 2.4 * R()) * s;
    let th = R() * PI;
    if (R() < align) th = (R() < 0.5 ? 0 : PI / 2) + (R() - 0.5) * 0.22;
    const a = 0.3 + 0.7 * R(), dx = cos(th), dy = sin(th);
    for (let w = -wd / 2; w <= wd / 2 + 1e-6; w += 0.7)
      for (let t = -len / 2; t <= len / 2; t += 0.5) splat(x0 + dx * t - dy * w, y0 + dy * t + dx * w, a * 0.5);
  }
  let m = 0, q = 0;
  for (let p = 0; p < N; p++) m += F[p];
  m /= N;
  for (let p = 0; p < N; p++) q += (F[p] - m) ** 2;
  const sd = sqrt(q / N) || 1;
  for (let p = 0; p < N; p++) F[p] = cl(0.5 + (0.22 * (F[p] - m)) / sd, 0, 1);
  P.weaveK = k;
}

// The round: the sheet comes down, settles, the palm smooths it, it shines,
// it lifts off, the skin shows bare. Durations in seconds at Speed 2.
const DESC = 0, HOLD = 1, SMOOTH = 2, GLOSS = 3, LIFT = 4, BARE = 5;
const DUR = [2.6, 1.0, 4.2, 3.0, 1.4, 0.7];
// The palm's edge is a bow, its middle A rows ahead of its ends.
const A = 22, MAXB = 20;

// Where each blister of round n would be trapped, its size and shape. All
// twenty are placed every round, so Bubbles only says how many of them are
// trapped and how big they swell, and the first six stay where they were.
function trap(P) {
  const n = P.round, b = P.bub;
  for (let i = 0; i < MAXB; i++) {
    let x = 0, y = 0, r = 0;
    for (let tr = 0; tr < 10; tr++) {
      const s = n * 7919 + i * 131 + tr * 17;
      x = 7 + 50 * hash(s);
      y = 10 + 108 * hash(s + 1);
      r = 3.6 + 4.6 * hash(s + 2) ** 1.5;
      let ok = true;
      for (let j = 0; j < i && ok; j++) if ((b[j].x - x) ** 2 + ((b[j].y - y) / 1.1) ** 2 < ((b[j].r + r) * 1.2 + 2) ** 2) ok = false;
      if (ok) break;
    }
    const e = 0.8 + 0.45 * hash(n * 7919 + i * 131 + 999);
    Object.assign(b[i], { x, y, r, rx: r * e, ry: r / e, h: 0.4 + 0.2 * r, age: -1, alive: true, side: hash(n * 31 + i) < 0.5 ? -1 : 1 });
  }
  // Wrinkles the sheet lays down with: a few long shallow ridges of air.
  P.wr = [];
  for (let i = 0; i < 2; i++) {
    // Down the sheet, as it hung, one in each half.
    const s = n * 4447 + i * 59, th = PI / 2 + (hash(s) - 0.5) * 0.9;
    P.wr.push({ x: 8 + 20 * hash(s + 1) + 28 * i, y: 30 + 68 * hash(s + 2), tx: cos(th), ty: sin(th), len: 14 + 12 * hash(s + 3) });
  }
}

export function setup(params) {
  buildTex();
  const bub = [];
  for (let i = 0; i < MAXB; i++) bub.push({});
  params.s = {
    c: 0, hue: 0, speed: 2, nb: 6, grow: 0, gs: 1, k4: 0.06, weaveK: -1,
    ph: DESC, pt: 0, round: 0, front: -40, fast: false,
    bub, wr: [], F: new Float32Array(N), Z: new Float32Array(N), AIR: new Float32Array(N), RIM: new Float32Array(N), SHD: new Float32Array(N),
    SQ: new Float32Array(N), SL: new Float32Array(N),
    tint: new Float32Array(3), warm: 0, lastHue: NaN,
  };
  // The skin's pearl, laid once: where its sheen sits on the colour wheel
  // and how light it is.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      params.s.SQ[y * W + x] = 0.5 * tap(x * 0.4 + 7, y * 0.4) + (x * 0.6 + y) / 170;
      params.s.SL[y * W + x] = 0.86 + 0.03 * tap(x * 1.3 + 50, y * 1.3);
    }
  trap(params.s);
}

// The sheet's hem and the line where it has wet through to the skin, as it
// comes down: the hem falls fast and slows, the wet line follows.
const hemAt = (q) => -4 + 140 * (1 - (1 - min(1, q / 0.65)) ** 2);
const wetAt = (q) => -10 + 146 * sm(q);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 6, 0.06], d0 = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.nb = floor(cl(k[2], 6, 20) + 0.5);
  P.grow = (P.nb - 6) / 14;
  P.gs = 1 + 0.4 * P.grow;
  P.k4 = cl(k[3], 0, 1);
  if (abs(P.k4 - P.weaveK) > 0.004) weave(P, P.k4);
  const d = (d0 * P.speed) / 2;
  P.c += d;
  P.pt += d;

  const tap1 = input.btnPressed && input.btnPressed[0];
  if (tap1) {
    if (P.ph === DESC || P.ph === HOLD) {
      // Blisters the wet line had not reached yet are never trapped.
      for (const b of P.bub) if (b.age < 0) b.alive = false;
      (P.ph = SMOOTH), (P.pt = 0), (P.fast = true), (P.front = -A - 10);
    } else if (P.ph === SMOOTH) P.fast = true;
    else if (P.ph === GLOSS) (P.ph = LIFT), (P.pt = 0);
  }
  // Blisters beyond the count asked for are never trapped; once the palm is
  // on the sheet the set is what it is.
  if (P.ph === DESC || P.ph === HOLD) for (let i = 0; i < MAXB; i++) P.bub[i].alive = i < P.nb;
  if (P.ph === SMOOTH) {
    P.front = P.fast ? P.front + d * 220 : -A - 10 + (H + 2 * A + 30) * sm(P.pt / DUR[SMOOTH]) ** 0.9;
    // The palm pushes each blister it reaches ahead of it and out towards
    // the nearer side, faster the further out it already is; squeezed, the
    // blister flattens along the palm's edge and loses a little air.
    for (const b of P.bub) {
      if (!b.alive) continue;
      const u = (b.x - 31.5) / 32, yf = P.front - A * u * u, top = b.y - b.ry * P.gs * 0.55;
      if (yf > top) {
        const dy = yf - top;
        const side = abs(u) < 0.08 ? b.side : u < 0 ? -1 : 1;
        b.y += dy;
        b.x += side * dy * (0.9 + 1.8 * abs(u));
        b.ry = max(b.r * 0.55, b.ry * (1 - 0.012 * dy));
        b.rx = min(b.r * 1.5, b.rx * (1 + 0.008 * dy));
        b.h *= 1 - 0.006 * dy;
      }
      if (b.x - b.rx * P.gs * 0.3 > W || b.x + b.rx * P.gs * 0.3 < 0 || b.y - b.ry * P.gs > H) b.alive = false;
    }
    if (P.front >= H + A + 19.9) (P.ph = GLOSS), (P.pt = 0), (P.fast = false);
  }
  if (P.ph !== SMOOTH && P.pt >= DUR[P.ph]) {
    P.pt = 0;
    if (P.ph === BARE) {
      P.round++;
      trap(P);
      P.ph = DESC;
    } else P.ph = P.ph === HOLD ? ((P.front = -A - 10), SMOOTH) : P.ph + 1;
  }
  // A blister fills as the wet line passes it, with a little overshoot.
  if (P.ph === DESC || P.ph === HOLD) {
    const wl = P.ph === DESC ? wetAt(P.pt / DUR[DESC]) : 999;
    for (const b of P.bub) if (b.alive && b.age < 0 && wl > b.y - b.ry * P.gs * 0.3) b.age = 0;
  }
  for (const b of P.bub) if (b.age >= 0) b.age += d;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { F, Z, AIR, RIM, SHD, SQ, SL, tint } = P, c = P.c, ph = P.ph, q = P.pt / DUR[ph];
  if (P.lastHue !== P.hue) {
    // From coral through peach and butter to lime the tint is paler and the
    // wet sheet lighter: at the aqua's depth those hues read tan and olive.
    let h = P.hue + 0.5;
    h -= floor(h);
    P.warm = sm((h + 0.02) / 0.07) * (1 - sm((h - 0.21) / 0.09));
    hsv(h, 0.56 - 0.28 * P.warm, 1, tint);
    P.lastHue = P.hue;
  }
  const warm = P.warm;

  // Where the sheet is: below its hem there is only skin while it comes
  // down, and behind the wet line it has soaked through.
  const hem = ph === DESC ? hemAt(q) : ph === BARE ? -99 : 999;
  const wl = ph === DESC ? wetAt(q) : ph >= BARE ? -99 : 999;
  // Lifting: in the first third air runs in under the sheet from its edges
  // and it goes white, then it rises off and fades.
  const air = ph === LIFT ? sm(q / 0.32) : 0, fade = ph === LIFT ? sm((q - 0.3) / 0.7) : ph === BARE ? 1 : 0;
  const rise = ph === LIFT ? 9 * sm((q - 0.25) / 0.75) : 0;
  const pressedAll = ph === GLOSS || ph === LIFT;
  // A small lamp drifts over the panel; the wet sheet mirrors it as a spot
  // that the fibres break into glints and the blisters bend round.
  const Lx = 32 + 40 * sin(0.37 * c + 0.5), Ly = 64 + 62 * sin(0.23 * c + 2), Lz = 45;
  const Ex = 32, Ey = 70, Ez = 240;

  // Heights: the skin's soft contour, the fibres standing a little, the
  // wrinkles of a sheet not yet pressed, and the blisters.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, fy = (((y + floor(rise)) % H) + H) % H;
      Z[p] = 1.1 * tap(x * 0.5, y * 0.5 + 40) + (0.22 + 0.3 * P.k4) * (F[fy * W + x] - 0.5);
      AIR[p] = 0;
      RIM[p] = 0;
      SHD[p] = 0;
    }
  if (ph <= SMOOTH) {
    for (const w of P.wr) {
      const ex = abs(w.tx) * w.len + 8, ey = abs(w.ty) * w.len + 8;
      for (let y = max(0, floor(w.y - ey)); y < min(H, w.y + ey); y++) {
        for (let x = max(0, floor(w.x - ex)); x < min(W, w.x + ex); x++) {
          const dx = x - w.x, dy = y - w.y, a = dx * w.tx + dy * w.ty, n = -dx * w.ty + dy * w.tx;
          if (abs(n) > 7 || abs(a) > w.len) continue;
          // The palm presses a wrinkle flat as it passes.
          const u = (x - 31.5) / 32, flat = ph === SMOOTH ? 1 - sm((P.front - A * u * u - y) / 2.5) : 1;
          const v = exp(-((n / 3) ** 2)) * sm((w.len - abs(a)) / 9) * flat;
          const p = y * W + x;
          Z[p] += 0.45 * v;
          AIR[p] = max(AIR[p], 0.25 * v);
        }
      }
    }
    for (const b of P.bub) {
      if (!b.alive || b.age < 0) continue;
      // Filling: a springy swell to full size in about a third of a second.
      const f = 1 - exp(-b.age / 0.09) * cos(b.age * 11), br = 1 + (ph === HOLD ? 0.03 * sin(c * 4 + b.r) : 0);
      const rx = b.rx * P.gs * min(1.08, f) * br, ry = b.ry * P.gs * min(1.08, f) * br, hh = b.h * P.gs * f, rm = min(rx, ry);
      let tlx = Lx - b.x, tly = Ly - b.y;
      const tl = 1 / (sqrt(tlx * tlx + tly * tly) || 1);
      (tlx *= tl), (tly *= tl);
      const x0 = max(0, floor(b.x - rx - 4)), x1 = min(W - 1, floor(b.x + rx + 4));
      const y0 = max(0, floor(b.y - ry - 4)), y1 = min(H - 1, floor(b.y + ry + 4));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const ex = (x - b.x) / rx, ey = (y - b.y) / ry, dd = ex * ex + ey * ey, p = y * W + x, dr = sqrt(dd);
          const face = dr > 0 ? (ex * tlx + ey * tly) / dr : 0;
          if (dd < 1) {
            // A pillow, rounder on top than a dome.
            Z[p] += hh * sm((1 - dd) / 0.75);
            AIR[p] = max(AIR[p], sm((1 - dr) / 0.3));
          }
          // A bright rim where the sheet lifts off the skin, brightest on
          // the lamp's side, and a soft shadow on the skin past the far side.
          RIM[p] = max(RIM[p], exp(-((((dr - 0.92) * rm) / 0.8) ** 2)) * (0.3 + 0.7 * max(0, face)));
          if (dr > 0.9) SHD[p] = max(SHD[p], exp(-((((dr - 1) * rm) / 1.8) ** 2)) * max(0, -face));
        }
    }
  }

  const tr = tint[0], tg = tint[1], tb = tint[2];
  const wetV = 0.88 + 0.09 * warm, mixT = 0.55 - 0.08 * warm;
  const front = P.front;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const zx = (Z[y * W + min(W - 1, x + 1)] - Z[y * W + max(0, x - 1)]) / 2;
      const zy = (Z[min(H - 1, y + 1) * W + x] - Z[max(0, y - 1) * W + x]) / 2;
      const nl = 1 / sqrt(zx * zx + zy * zy + 1), nx = -zx * nl, ny = -zy * nl, nz = nl;
      let lx = Lx - x, ly = Ly - y, lz = Lz - Z[p];
      const li = 1 / sqrt(lx * lx + ly * ly + lz * lz);
      (lx *= li), (ly *= li), (lz *= li);
      let vx = Ex - x, vy = Ey - y, vz = Ez;
      const vi = 1 / sqrt(vx * vx + vy * vy + vz * vz);
      (vx *= vi), (vy *= vi), (vz *= vi);
      let hx = lx + vx, hy = ly + vy, hz = lz + vz;
      const hi = 1 / sqrt(hx * hx + hy * hy + hz * hz);
      const nh = max(0, (nx * hx + ny * hy + nz * hz) * hi);
      // Shading against what a level sheet would get, so only slopes show.
      const shade = cl(1 + (nx * lx + ny * ly + nz * lz - lz), 0.55, 1.35);

      // The skin: a warm pearl whose sheen turns faintly pink, lilac and
      // mint across the panel.
      const qq = SQ[p] + c * 0.03, Ls = SL[p];
      let sr = (0.98 + 0.03 * cos(6.283 * qq)) * Ls, sg = (0.85 + 0.03 * cos(6.283 * (qq - 0.33))) * Ls, sb = (0.79 + 0.04 * cos(6.283 * (qq - 0.67))) * Ls;

      // How far the sheet has soaked onto the skin here, 0 (air under it)
      // to 1 (wet through), and how far the palm has pressed it.
      const u = (x - 31.5) / 32, ai = AIR[p];
      let contact = 1, pressed = pressedAll ? 1 : 0;
      if (ph === DESC) contact = sm((wl + 3 * sin(0.21 * x + 3 * c) + 2 * tap(x * 1.7, 9) - y) / 5);
      if (ph <= SMOOTH) {
        const yf = front - A * u * u;
        pressed = ph === SMOOTH ? sm((yf - y) / 2.5) : 0;
        // Not yet pressed, the sheet only half touches in places.
        const part = 0.76 - 0.26 * P.grow + (0.24 + 0.26 * P.grow) * sm(0.5 + 1.6 * tap(x * 1.2 + 90, y * 1.2 + 30));
        contact *= part + (1 - part) * pressed;
        contact *= 1 - ai * (1 - pressed);
      }
      if (ph === LIFT) {
        const ed = (0.6 * min(x + 0.5, W - 0.5 - x, (y + 0.5) / 2, (H - 0.5 - y) / 2)) / 32 + 0.4 * sm(0.5 + 1.4 * tap(x * 0.9 + 3, y * 0.9 + 70));
        contact *= 1 - sm((air * 1.1 - ed) / 0.08);
      }
      const fib = F[((((y + floor(rise)) % H) + H) % H) * W + x] - 0.5;

      // Wet through: the skin seen through the serum's tint, darker as
      // anything wet is. Over air: a hanging sheet is near white with its
      // fibres showing; a blister is the soaked sheet lit from inside, a
      // pale clear tint.
      const fk = 1 + 0.6 * P.k4, at = 0.08 + 0.42 * ai, af = (0.93 + 0.02 * ai) * (1 + 0.18 * fk * fib);
      const ar = (1 - at + tr * at) * af, ag = (1 - at + tg * at) * af, ab = (1 - at + tb * at) * af;
      const wk = wetV * (1 - 0.06 * pressed) * (1 + 0.1 * fk * fib);
      const wr = (sr * (1 - mixT) + tr * mixT) * wk, wg = (sg * (1 - mixT) + tg * mixT) * wk, wb = (sb * (1 - mixT) + tb * mixT) * wk;
      let r = ar + (wr - ar) * contact, g = ag + (wg - ag) * contact, b = ab + (wb - ab) * contact;
      const sd = 1 - 0.2 * SHD[p] * (1 - pressed);
      r *= shade * sd;
      g *= shade * sd;
      b *= shade * sd;
      // The sheen: broad and soft on the half-dry sheet, tighter and much
      // brighter where the palm has pressed the serum through.
      const ks = 0.1 + 0.22 * contact + 0.22 * pressed, shin = 12 + 20 * contact + 110 * pressed;
      // The blister's skin is wet serum too: a small sharp spot on each one.
      let sp = ks * nh ** shin + 0.1 * pressed * nh ** 24 + 0.55 * ai * nh ** 70 + 0.3 * RIM[p] * (1 - pressed);
      // The palm's edge pushes a bead of serum ahead of it: a bright line.
      if (ph === SMOOTH) {
        const e = y - (front - A * u * u);
        sp += (0.18 + 0.1 * fib) * exp(-(((e - 1) / 1.1) ** 2)) + 0.08 * exp(-(((e - 3) / 1.8) ** 2));
      }
      r += sp * (0.92 + 0.08 * tr);
      g += sp * (0.92 + 0.08 * tg);
      b += sp * (0.92 + 0.08 * tb);

      // Over the skin: the sheet is there above its hem and not yet lifted.
      let have = 1 - fade;
      if (ph === DESC) {
        const hy = hem + 1.5 * sin(0.15 * x + 1.3 * c);
        have = sm(hy - y + 0.5);
        // The hanging sheet: drape folds running down from the wet line,
        // and its shadow on the skin below the hem.
        if (y > wl && y < hy) {
          const fold = 0.045 * sin(x * 0.42 + 2.2 * sin(y * 0.05 + c) + 1.5 * tap(x * 0.5, y * 0.2)) * sm((y - wl) / 12);
          r *= 1 + fold;
          g *= 1 + fold;
          b *= 1 + fold;
        }
        const sh = 1 - 0.28 * exp(-max(0, y - hy) / 3.5) * sm(y - hy + 0.5);
        (sr *= sh), (sg *= sh), (sb *= sh);
        // The cut edge of the fabric catches the light.
        const ed = 0.22 * exp(-(((y - hy + 0.8) / 0.7) ** 2));
        (r += ed), (g += ed), (b += ed);
      }
      if (ph === LIFT) {
        // The lifted sheet's shadow on the skin, softening as it rises.
        const sh = 1 - 0.22 * (1 - fade) * air;
        (sr *= sh), (sg *= sh), (sb *= sh);
      }
      // Bare skin keeps a film of serum that shines and slowly soaks in.
      const dew = ph === LIFT ? sm((q - 0.2) / 0.5) : ph === BARE ? 1 - 0.6 * q : 0;
      if (dew > 0) {
        const ds = dew * 0.4 * nh ** 70;
        (sr += ds), (sg += ds), (sb += ds * 0.96);
      }
      r = sr + (r - sr) * have;
      g = sg + (g - sg) * have;
      b = sb + (b - sb) * have;
      display.setPixel(x, y, cl(r * 255, 0, 255), cl(g * 255, 0, 255), cl(b * 255, 0, 255));
    }
  }
}
