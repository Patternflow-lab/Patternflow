// ===== Patternflow pattern =====
// Title:   Cleansing Balm
// Family:  cosmetic
// Idea:    A whipped sherbet balm fills the panel, matte and frosty with spoon-scooped hollows and lips, until warmth climbs from the bottom and unseen fingertips press into it, and wherever it reaches the balm slumps into clear glossy oil with a wet rim at its edge, highlights gliding over it and a lighter glow showing through, while the oil runs down and pools at the bottom before a fresh layer is whipped on from the top.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 33, after a sherbet cleansing balm melting into oil
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Warmth=0..1, Grain=0..1
//
// Knob 1: Hue. The balm's colour, all the way round the wheel from pink sherbet at 0, the oil a deeper clear tint of it. Round orange and yellow the balm is paled and the oil lifted to honey, so neither goes brown.
// Knob 2: Speed. At 2 the warm front climbs 5 to 12 LEDs a second, a fingertip comes down every 1.4 to 3.2 s and one melt runs 18 to 22 s from fresh balm to fresh balm; at 0.2 all of it ten times slower.
// Knob 3: Warmth. How fast and how far it melts: at 0 the front climbs 5 LEDs a second and stops about 48 rows from the top, with a fingertip every 3.2 s; at 1 it climbs 12 a second and takes the whole panel, with a bigger fingertip every 1.4 s.
// Knob 4: Grain. The frost in the matte balm: at 0 a fine sugar a LED across over a soft whip; at 1 coarse crystals two or three LEDs across, with more sparkling specks and lumpier whip. The oil is smooth at any setting.
// Buttons: K1 tap presses a warm fingertip into the balm, and a round patch 20 LEDs across melts in a quarter of a second.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Pink sherbet at Hue 0.
const H0 = 0.95;
// A melted LED gives REL of oil. A film FILM thick clings where it is; above
// that the oil runs down, faster the thicker it is, and a cell holds at most
// CAP, so the pool fills up from the bottom row.
const REL = 0.42, FILM = 0.07, CAP = 1, KFLOW = 9;

// Smooth noise in a 128 x 128 tile, three octaves of 4, 8 and 16 cells.
const T = 128, TM = T - 1;
const TEX = new Float32Array(T * T);
const fade = (t) => t * t * (3 - 2 * t);
function buildTex() {
  TEX.fill(0);
  let amp = 1, tot = 0;
  for (let o = 0; o < 3; o++) {
    const cells = 4 << o, size = T / cells, g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
    for (let y = 0; y < T; y++) {
      const gy = floor(y / size), fy = fade(y / size - gy), y1 = (gy + 1) % cells;
      for (let x = 0; x < T; x++) {
        const gx = floor(x / size), fx = fade(x / size - gx), x1 = (gx + 1) % cells;
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

// The frost: a fine grain, one value per LED, and a coarse one, the same
// values blurred over 3 x 3 LEDs and scaled back up, so its crystals are two
// or three LEDs across. SPK picks the sparkling specks.
const GF = Float32Array.from({ length: N }, (_, i) => hash(i + 77) * 2 - 1);
const GC = new Float32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += GF[((y + dy + H) % H) * W + ((x + dx + W) % W)];
    GC[y * W + x] = s / 3;
  }
const SPK = Float32Array.from({ length: N }, (_, i) => hash(i + 991));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  buildTex();
  const F = (n) => new Float32Array(n);
  params.s = {
    Hb: F(N), mb: F(N), nz: F(N), Hn: F(N), mbN: F(N), nzN: F(N),
    m: F(N), F: F(N), age: F(N), Ho: F(N), Hs: F(N), wo: F(N),
    phase: 0, Yf: H + 10, Yl: -10, row: 0, hold: 0, T: 0, next: 1, fingers: [], dir: 1,
    hue: 0, speed: 2, warm: 0, grain: 0.06, wm: 0, started: false, col: F(7 * 3), colHue: NaN,
  };
}

// A fresh layer of balm. A soft whip of lumps, then fifteen spoon scoops, each
// an oval hollow 15 to 25 LEDs long with faint rings where the spoon's edge
// dragged and a lip of balm piled up at the end the spoon left by. nz is how
// long each LED holds out against warmth, and mk is the sherbet's marbling.
function lay(Hh, mk, nz) {
  const ox = rnd() * T, oy = rnd() * T;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      Hh[i] = 0.3 * tap(x * 1.7 + ox, y * 1.7 + oy);
      mk[i] = tap(x * 0.55 + oy, y * 0.38 + ox + 40);
      nz[i] = 0.9 * tap(x * 2.6 + ox + 60, y * 2.6 + oy);
    }
  for (let k = 0; k < 15; k++) {
    const L = 15 + rnd() * 10, Wd = L * (0.5 + 0.15 * rnd()), a = rnd() * 2 * PI, ca = cos(a), sa = sin(a);
    const cx = rnd() * W, cy = -6 + rnd() * (H + 12), E = L * 1.4;
    for (let y = max(0, floor(cy - E)); y <= min(H - 1, floor(cy + E)); y++)
      for (let x = max(0, floor(cx - E)); x <= min(W - 1, floor(cx + E)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / L, v = (-dx * sa + dy * ca) / Wd;
        const rho = sqrt(u * u + v * v);
        if (rho > 1.4) continue;
        const i = y * W + x, wgt = 1 - sm((rho - 0.82) / 0.3);
        const dish = rho < 1 ? -0.75 * (1 - rho * rho) + 0.025 * sin(rho * 19) : 0;
        const lip = 0.55 * exp(-(((rho - 1.02) / 0.14) ** 2)) * (0.4 + 0.6 * sm((u + 1) / 2));
        Hh[i] = Hh[i] * (1 - wgt) + dish * wgt + lip;
      }
  }
}

// A fingertip: it comes down at (x, y) and its warm print spreads to radius R
// over `grow` seconds, melting what it covers.
function finger(S, big) {
  let x = 8 + rnd() * (W - 16), y = 0;
  // Into the balm, above the front.
  const hiY = min(H - 10, S.Yf - 14);
  if (hiY > 12) y = 8 + rnd() * (hiY - 8);
  else y = 10 + rnd() * (H - 20);
  if (big) x = 14 + rnd() * (W - 28);
  S.fingers.push({ x, y, R: big ? 10 : 6 + rnd() * 4 + 3 * S.warm, grow: big ? 0.25 : 0.8, t: 0, r: 0 });
}

function step(S, st) {
  const { m, F, age, Hb, nz } = S;
  S.T += st;
  if (S.phase === 0) {
    S.Yf -= st * (5 + 7 * S.warm);
    S.next -= st;
    if (S.next <= 0) {
      S.next = (3.2 - 1.8 * S.warm) * (0.7 + 0.6 * rnd());
      finger(S, false);
    }
    if (S.Yf < H - (0.57 + 0.5 * S.warm) * (H + 12)) {
      S.phase = 1;
      S.hold = 0;
    }
  } else if (S.phase === 1) {
    S.hold += st;
    if (S.hold > 1.5) {
      // Whip a fresh layer on from the top.
      S.phase = 2;
      S.Yl = -6;
      S.row = 0;
      S.Yf = H + 1000;
      lay(S.Hn, S.mbN, S.nzN);
    }
  } else {
    S.Yl += st * 46;
    const to = min(H, floor(S.Yl));
    for (; S.row < to; S.row++)
      for (let x = 0, i = S.row * W; x < W; x++, i++) {
        Hb[i] = S.Hn[i];
        S.mb[i] = S.mbN[i];
        nz[i] = S.nzN[i];
        m[i] = 0;
        F[i] = 0;
        age[i] = 0;
      }
    if (S.Yl > H + 8) {
      S.phase = 0;
      S.Yf = H + 10;
      S.next = 0.6;
      S.fingers.length = 0;
    }
  }
  // The front: LEDs below it melt, ridges and the lumps of nz holding out a
  // few rows longer, so it climbs ragged. Once an LED starts it melts through
  // in about 0.4 s, and that band is the wet rim.
  for (let y = 0, i = 0; y < H; y++) {
    const wf = (y - S.Yf) / 4;
    for (let x = 0; x < W; x++, i++) {
      if (m[i] >= 1) {
        age[i] += st;
        continue;
      }
      if (m[i] > 0 || wf > 0.9 * Hb[i] + nz[i]) {
        const dm = min(1 - m[i], st * 2.4);
        m[i] += dm;
        F[i] += dm * REL;
      }
    }
  }
  const fs = S.fingers;
  for (let k = fs.length - 1; k >= 0; k--) {
    const f = fs[k];
    f.t += st;
    f.r = f.R * sm(f.t / f.grow);
    const E = f.R + 3;
    for (let y = max(0, floor(f.y - E)); y <= min(H - 1, floor(f.y + E)); y++)
      for (let x = max(0, floor(f.x - E)); x <= min(W - 1, floor(f.x + E)); x++) {
        const i = y * W + x;
        if (m[i] > 0) continue;
        const d = Math.hypot(x + 0.5 - f.x, y + 0.5 - f.y);
        if (d < f.r - 1.5 * (0.9 * Hb[i] + nz[i])) m[i] = 0.01;
      }
    if (f.t > f.grow + 0.5) fs.splice(k, 1);
  }
  // The oil runs down a row at a time, bottom row first so nothing moves two
  // rows in one step.
  for (let y = H - 2; y >= 0; y--)
    for (let x = 0, i = y * W; x < W; x++, i++) {
      // Unmelted balm soaks up a little, so oil only trickles over it.
      const mob = F[i] - (m[i] > 0 ? FILM : 0.22);
      if (mob <= 0) continue;
      const j = i + W;
      let fl = min(mob, st * KFLOW * mob * (0.25 + F[i]));
      fl = min(fl, CAP - F[j]);
      if (fl <= 0) continue;
      F[i] -= fl;
      F[j] += fl;
    }
  // The oil levels out sideways, quickly where it is deep, so the pool's top
  // is flat and a film does not keep the stripes it ran down in.
  S.dir = -S.dir;
  for (let y = 0; y < H; y++) {
    const r0 = y * W;
    for (let n = 0; n < W - 1; n++) {
      const x = S.dir > 0 ? n : W - 2 - n, i = r0 + x, d = F[i] - F[i + 1];
      if (F[i] < FILM && F[i + 1] < FILM) continue;
      const mv = d * (F[i] > 0.3 || F[i + 1] > 0.3 ? 0.35 : 0.15);
      F[i] -= mv;
      F[i + 1] += mv;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.warm = cl(k[2], 0, 1);
  S.grain = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    lay(S.Hb, S.mb, S.nz);
    // Open with the bottom fifth already melted and a fingertip or two in.
    S.Yf = H - 12;
    S.next = 0.3;
    for (let i = 0; i < 70; i++) step(S, 1 / 20);
  }
  if (input.btnPressed && input.btnPressed[0]) finger(S, true);
  step(S, (d * S.speed) / 2);
}

// Colours: the sherbet, its creamy marbling, the glow under the oil, the
// oil's own tint, the wet rim and the frost's specks.
function palette(S) {
  const c = S.col, h = S.hue + H0, hf = h - floor(h);
  // Orange and gold go brown at middle light on the LEDs, so round them
  // everything is lifted and paled: apricot, peach and butter.
  const dw = abs(hf - 0.13), wm = sm(1.5 - min(dw, 1 - dw) / 0.12);
  hsv(h, 0.44 - 0.14 * wm, 0.98, c, 0);
  hsv(h - 0.015, 0.22 - 0.06 * wm, 1, c, 3);
  hsv(h - 0.02, 0.32 - 0.1 * wm, 1, c, 6);
  hsv(h + 0.015, 0.78 - 0.38 * wm, 0.62 + 0.36 * wm, c, 9);
  hsv(h, 0.22, 1, c, 12);
  hsv(h + 0.05, 0.08, 1, c, 15);
  S.wm = wm;
  S.colHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  if (S.colHue !== S.hue) palette(S);
  const { Hb, mb, m, F, age, Ho, Hs, col } = S, t = S.T;
  // How much of each LED is oil: all of it once melted, and a wet film
  // where oil runs down over balm that has not melted yet.
  const wo = S.wo;
  for (let i = 0; i < N; i++) wo[i] = max(m[i], 0.7 * sm((F[i] - 0.12) / 0.3));
  // The oil's surface: what is left of the balm's shape as it slumps flat in
  // the two seconds after melting, the oil's own depth, and slow ripples
  // carried down the panel at about 6 LEDs a second, then softened over
  // 3 x 3 LEDs so the oil has no grain at all.
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      if (wo[i] <= 0) {
        Ho[i] = Hb[i] * 0.7;
        continue;
      }
      const sl = m[i] > 0 ? max(0, 1 - age[i] / 2) : 1, f = min(F[i], 1.2);
      Ho[i] = 0.7 * Hb[i] * sl + 1.2 * f + 0.35 * tap(x * 1.1 + 20, y * 0.7 - t * 5) * (0.4 + f);
    }
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) Hs[i] = (Ho[i - (x > 0 ? 1 : 0)] + 2 * Ho[i] + Ho[i + (x < W - 1 ? 1 : 0)]) * 0.25;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) Ho[i] = (Hs[i - (y > 0 ? W : 0)] + 2 * Hs[i] + Hs[i + (y < H - 1 ? W : 0)]) * 0.25;
  const g = S.grain, gA = 0.04 + 0.17 * g, spD = 0.03 + 0.09 * g, spV = 0.09 + 0.08 * g, lumps = 1 + 0.35 * g;
  // A small light 60 degrees off the face of the panel wanders round the top
  // left, so flat oil never catches it and only the slopes of ripples,
  // slumping lumps and the pool's edge glint. Two long reflections of strip
  // lights sweep across the oil and back every 18 s at Speed 2.
  const az = -2.2 + 0.7 * sin(t * 0.37), lx = 0.866 * cos(az), ly = 0.866 * sin(az), lz = 0.5;
  const hx0 = lx, hy0 = ly, hz0 = lz + 1, hl = Math.hypot(hx0, hy0, hz0);
  const hx = hx0 / hl, hy = hy0 / hl, hz = hz0 / hl;
  const band = 1.1 * sin(t * 0.35), band2 = band + (band > 0 ? -1.4 : 1.4);
  // Warm oil at middle light is brown, so round orange and gold the oil
  // glows brighter and turns to honey.
  const lift = 1 + 0.32 * S.wm, tk = 0.85 + 0.25 * S.wm;
  // The edge of a fresh layer being whipped on stands up as a rolled ridge.
  const whip = S.phase === 2, Yl = S.Yl;
  for (let y = 0, i = 0; y < H; y++) {
    const up = y > 0 ? -W : 0, dn = y < H - 1 ? W : 0;
    const roll = whip ? 0.9 * exp(-(((y - Yl + 2.5) / 2.6) ** 2)) : 0, rollU = whip ? 0.9 * exp(-(((y - 1 - Yl + 2.5) / 2.6) ** 2)) : 0;
    for (let x = 0; x < W; x++, i++) {
      const lf = x > 0 ? -1 : 0, rt = x < W - 1 ? 1 : 0;
      const mm = m[i], w = wo[i];
      let r = 0, gg = 0, b = 0;
      if (mm < 1) {
        // Matte balm: soft light from the top left, a little darker deep in
        // the hollows, the marbling between sherbet and cream, and frost.
        const ddx = (Hb[i + rt] - Hb[i + lf]) * 2.2 * lumps, ddy = (Hb[i + dn] - Hb[i + up]) * 2.2 * lumps + (roll - rollU) * 3;
        const dif = (0.45 * ddx + 0.62 * ddy + 0.64) / sqrt(ddx * ddx + ddy * ddy + 1);
        const sh = 0.8 + 0.22 * dif + 0.05 * cl(Hb[i] + roll, -0.8, 0.6);
        const mk = sm(0.5 + 1.2 * sin(mb[i] * 11 + 0.8));
        const f = sh * (1 + gA * (GF[i] * (1 - g) + GC[i] * g));
        const sp = SPK[i] > 1 - spD ? spV : 0;
        r = (col[0] + (col[3] - col[0]) * mk) * f + sp;
        gg = (col[1] + (col[4] - col[1]) * mk) * f + sp;
        b = (col[2] + (col[5] - col[2]) * mk) * f + sp;
      }
      if (w > 0) {
        // Oil: the glow under it seen through a tint that deepens with the
        // oil's depth, a sharp highlight from the small light, and the strip
        // light's long reflection.
        const nx = -(Ho[i + rt] - Ho[i + lf]) * 3.5, ny = -(Ho[i + dn] - Ho[i + up]) * 3.5, nl = 1 / sqrt(nx * nx + ny * ny + 1);
        const nd = (nx * hx + ny * hy + hz) * nl;
        const spec = nd > 0.9 ? ((nd - 0.9) / 0.1) ** 2 : 0;
        const e = 2 * nl * (nx * 0.5 + ny * 0.85) * nl + (x - 32) / 90 + (y - 64) / 70, q = (e - band) / 0.14, q2 = (e - band2) / 0.1;
        const s = min(1, spec) + 0.42 * exp(-q * q) + 0.28 * exp(-q2 * q2);
        const dep = 0.3 + F[i], a = 1 - exp(-1.1 * dep);
        const glow = (0.55 + 0.3 * tap(x * 0.6 + 70, y * 0.4 - t * 1.5)) * lift;
        const orr = col[6] * glow * (1 - a) + col[9] * a * tk + s;
        const og = col[7] * glow * (1 - a) + col[10] * a * tk + s;
        const ob = col[8] * glow * (1 - a) + col[11] * a * tk + s;
        r = r * (1 - w) + orr * w;
        gg = gg * (1 - w) + og * w;
        b = b * (1 - w) + ob * w;
        // The wet rim: the band where the balm is turning, and the oil's
        // edge against balm, a pale glassy line with a glint.
        let rim = mm > 0 && mm < 1 ? 4 * mm * (1 - mm) : 0;
        if (mm >= 1 && (m[i + lf] < 0.5 || m[i + rt] < 0.5 || m[i + up] < 0.5 || m[i + dn] < 0.5)) rim = 0.8;
        if (rim > 0) {
          const k = 0.45 * rim;
          r += (col[12] - r) * k + 0.1 * rim;
          gg += (col[13] - gg) * k + 0.1 * rim;
          b += (col[14] - b) * k + 0.1 * rim;
        }
      }
      display.setPixel(x, y, cl(r * 255, 0, 255), cl(gg * 255, 0, 255), cl(b * 255, 0, 255));
    }
  }
}
