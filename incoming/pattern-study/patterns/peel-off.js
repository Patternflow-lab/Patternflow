// ===== Patternflow pattern =====
// Title:   Peel-Off
// Family:  cosmetic
// Idea:    A glossy tinted gel film covers a pearly skin-toned base and an unseen hand peels it from the top edge down, the film lifting into a rolling curl with a bright rim and its paler underside out, the peel line wavering as the film catches, stretches and snaps free, until the sheet leaves the bottom and a wet new coat flows down from the top and dries to a soft satin for the next peel.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 33, after a peel-off gel mask lifted off in one sheet
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Thickness=0..1, Curl=0..1
//
// Knob 1: Hue. The gel's colour, all the way round the wheel from violet at 0; the curl shows it paler. From red round to lime the gel is laid lighter than the skin, coral, peach, butter and pale lime, because at the violet's depth those hues read as brick, tan, khaki and olive.
// Knob 2: Speed. How fast it all runs. At 2 the peel crosses the 128 rows in 7.5 s, the bare skin shows for 1.2 s, the new coat flows down in 2.4 s and each row of it dries in about 3, 15 s round; at 0.2 ten times slower.
// Knob 3: Thickness. How thick the gel is laid. At 0 a sheer film that lets the pearl of the skin show through it; at 1 a deep, nearly opaque coat with a stronger shine.
// Knob 4: Curl. How tight the film rolls as it comes away: at 0 a roll 9 rows across at the top that grows to 14 as it gathers the sheet on its way down; at 1, 26 growing to 40.
// Buttons: K1 tap starts the peel at once; on bare skin it lays the new coat first and peels as soon as the coat is down.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Smooth noise in a 128 x 128 tile that wraps, octaves of 8, 16 and 32
// cells, built once: the pearl of the skin and the gel's uneven thickness.
const T = 128, TM = T - 1;
const TEX = new Float32Array(T * T);
function buildTex() {
  TEX.fill(0);
  let amp = 1, tot = 0;
  for (let o = 0; o < 3; o++) {
    const cells = 8 << o, size = T / cells, g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = hash(i * 7 + o * 9973) * 2 - 1;
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

// Phases: the film peels, the skin shows bare, a new coat flows on, it dries.
const PEEL = 0, BARE = 1, COAT = 2, DRY = 3;
const PEEL_T = 7.5, BARE_T = 1.2, COAT_T = 2.4, DRY_T = 3.8;

// The light: above and a little left, in front.
const LX = -0.15, LY = -0.75, LZ = -0.64, LN = 1 / sqrt(LX * LX + LY * LY + LZ * LZ);
const HX = LX * LN, HY = LY * LN, HZ = LZ * LN - 1, HN = 1 / sqrt(HX * HX + HY * HY + HZ * HZ);

export function setup(params) {
  buildTex();
  params.s = {
    t: 0, hue: 0, speed: 2, thick: 0, curl: 0.06,
    phase: PEEL, pt: 0, coatAge: 99, queue: false,
    yf: new Float32Array(W), rr: new Float32Array(W), roll: 0, R0: 6,
    unc: new Float32Array(N).fill(-1),
    sticks: [{ x: 20, w: 9, a: 4, age: -0.8, len: 1.2 }, { x: 46, w: 7, a: 3.5, age: -2.6, len: 1.0 }],
    tint: new Float32Array(3), warm: 0, lastHue: NaN,
  };
}

// Where the coat's leading edge is, pt seconds into the coat: it flows fast
// from the top and slows as it reaches the bottom.
const coatFront = (pt) => -4 + 136 * (1 - (1 - min(1, pt / COAT_T)) ** 2);
// When it passed row y, for how wet that row still is.
const coatPassed = (y) => COAT_T * (1 - sqrt(cl(1 - (y + 4) / 136, 0, 1)));

// The peel line: it starts above the top edge and leaves below the bottom.
function peelY(P, pr) {
  const span = H + 2.6 * P.R0 + 6, e = pr < 0.08 ? (pr * pr) / 0.16 : pr - 0.04;
  return -1.3 * P.R0 - 2 + (span * e) / 0.96;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d0 = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.thick = cl(k[2], 0, 1);
  P.curl = cl(k[3], 0, 1);
  P.R0 = 5.5 + 10 * P.curl;
  const d = (d0 * P.speed) / 2;
  P.t += d;
  P.pt += d;
  P.coatAge += d;

  if (input.btnPressed && input.btnPressed[0]) {
    if (P.phase === DRY) (P.phase = PEEL), (P.pt = 0), P.unc.fill(-1);
    else if (P.phase === BARE) (P.phase = COAT), (P.pt = 0), (P.coatAge = 0), (P.queue = true);
    else if (P.phase === COAT) P.queue = true;
  }
  if (P.phase === PEEL && P.pt >= PEEL_T) (P.phase = BARE), (P.pt = 0);
  else if (P.phase === BARE && P.pt >= BARE_T) (P.phase = COAT), (P.pt = 0), (P.coatAge = 0);
  else if (P.phase === COAT && P.pt >= COAT_T) {
    P.phase = P.queue ? PEEL : DRY;
    P.pt = 0;
    P.queue = false;
    if (P.phase === PEEL) P.unc.fill(-1);
  } else if (P.phase === DRY && P.pt >= DRY_T) (P.phase = PEEL), (P.pt = 0), P.unc.fill(-1);

  // Spots where the gel holds on. Each one holds the peel line back for about
  // a second while the film stretches, up to 5 rows, then lets go: the line
  // snaps forward past straight and settles in a fifth of a second.
  for (const s of P.sticks) {
    s.age += d;
    if (s.age > s.len + 0.35) {
      s.age = -0.3 - 1.4 * Math.random();
      s.x = 6 + Math.random() * 52;
      s.w = 6 + Math.random() * 6;
      s.a = 2.5 + Math.random() * 3;
      s.len = 0.8 + Math.random() * 0.6;
    }
  }
  if (P.phase === PEEL) {
    const pr = P.pt / PEEL_T, Y = peelY(P, pr), t = P.t;
    // The roll gathers the sheet and grows by half on its way down.
    const R = P.R0 * (0.85 + 0.45 * pr);
    P.roll = Y;
    for (let x = 0; x < W; x++) {
      let y = Y + 1.3 * sin(0.11 * x + 0.9 * t) + 0.8 * sin(0.27 * x - 1.4 * t + 1) + 1.2 * tap(x * 0.9, t * 3);
      for (const s of P.sticks) {
        if (s.age < 0) continue;
        const g = exp(-(((x - s.x) / s.w) ** 2));
        let lag;
        if (s.age < s.len) lag = s.a * (s.age / s.len) ** 1.5;
        else {
          const q = s.age - s.len;
          lag = s.a * exp(-q / 0.07) * cos(q * 26);
        }
        y -= lag * g;
      }
      P.yf[x] = y;
      P.rr[x] = R * (1 + 0.07 * sin(0.2 * x + 0.5 * t));
      // Skin the peel has just passed over keeps a fresh glow for a while.
      const top = min(H, max(0, floor(y)));
      for (let yy = 0; yy < top; yy++) {
        const p = yy * W + x;
        if (P.unc[p] < 0) P.unc[p] = t;
      }
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const t = P.t, ph = P.phase, k3 = P.thick, tint = P.tint;
  if (P.lastHue !== P.hue) {
    // From red through orange and gold to lime the gel is lifted towards
    // coral, peach, butter and pale lime: less saturation and more light than
    // the skin, so it reads as a lit jelly. At 0.6 of full these hues read as
    // brick, tan, khaki and olive.
    let h = P.hue + 0.78;
    h -= floor(h);
    let dh = h - 0.13;
    if (dh > 0.5) dh -= 1;
    P.warm = sm(1 - abs(dh) / 0.21);
    hsv(h, 0.68 - 0.28 * P.warm, 1, tint);
    P.lastHue = P.hue;
  }
  const warm = P.warm, tr = tint[0], tg = tint[1], tb = tint[2];
  // The gel's own colour at the start knobs is about 0.6 of full: deep enough
  // that the peel reads as a change of light, not only of colour.
  const deepV = 0.6 + 0.65 * warm - 0.14 * k3 * (1 - warm), op = 0.55 + 0.4 * k3;
  const cf = ph === COAT ? coatFront(P.pt) : 0;
  // A strip light's reflection drifts slowly across the gel.
  const sweep = 52 + 34 * sin(t * 0.21);
  // The broad glow on the skin wanders.
  const gx = 32 + 20 * sin(t * 0.17), gy = 64 + 40 * sin(t * 0.11 + 1);

  for (let x = 0; x < W; x++) {
    const yf = P.yf[x], R = P.rr[x], wob = 1.5 * sin(0.2 * x + 3 * P.pt) + sin(0.37 * x - 2 * P.pt);
    for (let y = 0; y < H; y++) {
      const p = y * W + x;
      // Is there gel here, and how wet is it?
      let film;
      if (ph === PEEL) film = y > yf;
      else if (ph === DRY) film = true;
      else if (ph === BARE) film = false;
      else film = y < cf + wob;
      const wet = film ? exp(-max(0, P.coatAge - coatPassed(y)) / 1.4) : 0;

      // The skin: a warm pearl whose sheen turns faintly pink, lilac and mint
      // across the panel, a broad soft glow that wanders, fine shimmer, and a
      // fresh glow where the film has just come off.
      const q = 0.5 * tap(x * 0.45 + 7, y * 0.45 + t * 0.8) + (x * 0.6 + y) / 170 + t * 0.03;
      const gl = exp(-((x - gx) ** 2 + (y - gy) ** 2 * 0.3) / 1300);
      const fr = P.unc[p] >= 0 ? exp(-(t - P.unc[p]) / 2.2) : 0;
      const L = 0.8 + 0.13 * gl + 0.1 * fr + 0.02 * (hash(p) - 0.5);
      let r = (1 + 0.035 * cos(TAU * q) + 0.03 * fr) * L;
      let g = (0.875 + 0.03 * cos(TAU * (q - 0.33))) * L;
      let b = (0.83 + 0.04 * cos(TAU * (q - 0.67)) + 0.015 * fr) * L;
      const hs = hash(p + 101);
      if (hs < 0.022) {
        const tw = max(0, sin(t * (2.4 + 40 * hs) + hash(p + 5) * 40)) ** 10 * (0.4 + 0.3 * gl);
        r += tw;
        g += tw;
        b += tw;
      }

      if (film) {
        // The gel: its own deep colour over the skin seen through it, uneven
        // in thickness, deeper while wet. Wet, the strip light shows as a
        // sharp band that the coat's ripples bend; dry, a broad soft sheen
        // over a fine satin grain.
        const th = tap(x * 0.8 + 60, y * 0.8 + 31);
        const dv = deepV * (1 + (0.2 * th - 0.1 * wet) * (1 - 0.7 * warm)), thr = 1 - op;
        r = tr * dv * op + r * (0.5 + 0.5 * tr) * thr * 0.8;
        g = tg * dv * op + g * (0.5 + 0.5 * tg) * thr * 0.8;
        b = tb * dv * op + b * (0.5 + 0.5 * tb) * thr * 0.8;
        const rip = ph === COAT ? 2.5 * wet * sin((y - cf) * 0.32 - P.pt * 5) * exp(-max(0, cf - y) / 30) : 0;
        const band = x * 0.5 + y * 0.42 + th * 4 + rip - sweep;
        const wd = 13 - 8.5 * wet, amp = 0.15 + 0.12 * k3 + 0.55 * wet;
        let hl = amp * exp(-((band / wd) ** 2)) + 0.3 * wet * exp(-(((band + 24) / 2.5) ** 2));
        // Behind the coat's edge the wet gel still moves in low swells, each
        // catching a thin line of light, and they die out as it settles.
        if (ph === COAT && y < cf + wob) hl += 0.3 * wet * max(0, sin((y - cf - wob) * 0.42 - P.pt * 5)) ** 8 * exp(-(cf - y) / 26);
        const grain = (1 - wet) * 0.04 * (hash(p + 33) - 0.5);
        r += hl * (0.85 + 0.15 * tr) + grain;
        g += hl * (0.85 + 0.15 * tg) + grain;
        b += hl * (0.85 + 0.15 * tb) + grain;
        // The new coat's leading edge is a ridge of wet gel: a line of light
        // on its upper slope, deeper colour where it is thickest.
        if (ph === COAT) {
          const e = y - (cf + wob);
          if (e > -6) {
            const deep = 1 - 0.28 * exp(-(((e + 1.2) / 1.3) ** 2)), hi = 0.75 * exp(-(((e + 3.2) / 0.9) ** 2));
            r = r * deep + hi;
            g = g * deep + hi;
            b = b * deep + hi;
          }
        }
        // Below the curl, its shadow on the film, lighter on the warm hues,
        // where a deep shadow turns butter to olive.
        if (ph === PEEL) {
          const sd = (0.45 - 0.22 * warm) * exp(-max(0, y - yf - R * 0.9) / (0.7 * R + 1));
          r *= 1 - sd;
          g *= 1 - sd;
          b *= 1 - sd;
        }
      }

      // The curl: a cylinder of film lying on the skin along the peel line,
      // its paler underside out. Its material turns as it rolls, carrying faint
      // stretch lines and the edge of the outer turn round with it, and light
      // coming through the gel tints its lower edge.
      if (ph === PEEL) {
        const v = (y - yf) / R;
        if (v < -1 && v > -1.6) {
          // A little shade on the skin just above the roll.
          const ao = 0.2 * sm((v + 1.6) / 0.6);
          r *= 1 - ao;
          g *= 1 - ao;
          b *= 1 - ao;
        }
        if (v > -1.05 && v < 1.05) {
          const vv = cl(v, -0.999, 0.999), nz = sqrt(1 - vv * vv);
          const dif = max(0, (vv * LY - nz * LZ) * LN);
          const sp = max(0, (vv * HY - nz * HZ) * HN) ** 30;
          const s = atan2(vv, nz) * R - P.roll;
          const str = 0.05 * sin(s * 0.8 + tap(x * 0.7, 40) * 5);
          let ed = (s / (TAU * R)) % 1;
          if (ed < 0) ed += 1;
          const line = 0.16 * exp(-(((ed > 0.5 ? ed - 1 : ed) / 0.025) ** 2));
          const lit = (0.32 + 0.3 * warm + 0.62 * dif) * (1 + str - line);
          const rim = (1 - nz) ** 2 * 0.4, glow = 0.35 * sm((vv - 0.1) / 0.8);
          const ur = 0.3 + 0.7 * tr, ug = 0.3 + 0.7 * tg, ub = 0.3 + 0.7 * tb;
          const cr = ur * lit + (rim + glow) * tr + sp;
          const cg = ug * lit + (rim + glow) * tg + sp;
          const cbl = ub * lit + (rim + glow) * tb + sp;
          const cov = cl((1 - abs(v)) * R + 0.5, 0, 1);
          r += (cr - r) * cov;
          g += (cg - g) * cov;
          b += (cbl - b) * cov;
        }
      }
      display.setPixel(x, y, cl(r * 255, 0, 255), cl(g * 255, 0, 255), cl(b * 255, 0, 255));
    }
  }
}
