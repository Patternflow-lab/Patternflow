// ===== Patternflow pattern =====
// Title:   Haunted Carousel
// Family:  halloween
// Idea:    A merry-go-round turns alone in an empty fairground at night, its striped canopy and ring of orange bulbs wheeling overhead while skeleton horses on brass poles rise and fall past the mirrored centre column, until now and then it lurches faster, the bulbs go toxic green and ghostly riders sit on the horses and stare out at us, then it slows and they fade.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 53, after a carousel in an empty fairground at night
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Horses=5..8, Fog=-1..1
//
// Knob 1: Hue. The night in the sky, the fog, the dark canopy stripes and the platform's panels: purple at 0, deep blue at 0.3, sea blue at 0.6, green at 1. The tops of the bright stripes go from pink at 0 to cyan at 1. The bulbs stay orange, green in a lurch, and the bones stay white.
// Knob 2: Speed. At 2 the carousel turns once in 15 seconds and each horse rises and falls three times a turn; the first lurch comes at 4 seconds and one every 17 after, two and a half times as fast for 3 seconds before it slows over 3 more. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Horses. How many horses ride the ring, 5 to 8, spaced evenly; at 8 they run nose to tail.
// Knob 4: Fog. Ground fog drifting round the platform: none at -1, a low bank over the ground at the opening 0.06, and at 1 a deep bank up to the horses' hooves.
// Buttons: K1 tap starts a lurch now.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, atan2, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));
const fr = (v) => v - floor(v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v) {
  h = fr(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The camera stands D0 from the carousel's axis at the height of the horses'
// backs, so a point (x, h, z) with z toward us lands at x 32 + F x / (D0 - z),
// y 64 - F h / (D0 - z). Lengths are in canopy radii.
const F = 150, D0 = 5;
const VB = 0.8, VT = 1, HA = 1.85, RC = 0.19, RP = 0.78, RF = 1.05, PT = -0.95, PG = -1.07;
// Surfaces: sky, cone, valance, ceiling, valance seen from inside, finial,
// column, platform top, platform side, ground.
const SKY = 0, CONE = 1, VAL = 2, CEIL = 3, VIN = 4, FIN = 5, COL = 6, TOPS = 7, SIDE = 8, GND = 9;
const proj = (x, h, z) => [32 + (F * x) / (D0 - z), 64 - (F * h) / (D0 - z), D0 - z];

// Every LED's first fixed surface along its view line, found once.
const KIND = new Uint8Array(N), DEP = new Float32Array(N).fill(1e9), ANG = new Float32Array(N), AUX = new Float32Array(N);
for (let y = 0, p = 0; y < H; y++)
  for (let x = 0; x < W; x++, p++) {
    const a = (x + 0.5 - 32) / F, b = (64 - y - 0.5) / F, A2 = a * a + 1;
    let best = 1e9, k = SKY, aux = 0;
    const hit = (t, kk, v) => t > 0 && t < best && ((best = t), (k = kk), (aux = v));
    const cyl = (R) => {
      const d = D0 * D0 - A2 * (D0 * D0 - R * R);
      return d < 0 ? null : [(D0 - sqrt(d)) / A2, (D0 + sqrt(d)) / A2];
    };
    let c = cyl(1);
    if (c) {
      if (b * c[0] >= VB && b * c[0] <= VT) hit(c[0], VAL, b * c[0]);
      if (b * c[1] >= VB && b * c[1] <= VT) hit(c[1], VIN, b * c[1]);
    }
    if (b > 0) {
      const t = VT / b, r = Math.hypot(a * t, D0 - t);
      if (r <= 1) hit(t, CEIL, r);
    }
    // The cone: radius (HA - h) / (HA - VT).
    const kk = (HA - VT) ** 2, qa = A2 - (b * b) / kk, qb = -2 * D0 + (2 * HA * b) / kk, qc = D0 * D0 - (HA * HA) / kk;
    const disc = qb * qb - 4 * qa * qc;
    if (disc >= 0 && abs(qa) > 1e-9)
      for (const t of [(-qb - sqrt(disc)) / (2 * qa), (-qb + sqrt(disc)) / (2 * qa)]) if (b * t >= VT && b * t <= HA) hit(t, CONE, b * t);
    const hf = b * D0;
    if (hf > HA - 0.05 && hf < 2.08 && abs(a * D0) < (hf > 1.98 ? 0.045 : 0.022)) hit(D0, FIN, hf);
    c = cyl(RC);
    if (c && b * c[0] >= PT && b * c[0] <= VT) hit(c[0], COL, b * c[0]);
    if (b < 0) {
      const t = PT / b;
      if (Math.hypot(a * t, D0 - t) <= RF) hit(t, TOPS, Math.hypot(a * t, D0 - t));
    }
    c = cyl(RF);
    if (c && b * c[0] >= PG && b * c[0] <= PT) hit(c[0], SIDE, b * c[0]);
    if (b < 0) hit(PG / b, GND, Math.hypot((a * PG) / b, D0 - PG / b));
    KIND[p] = k;
    DEP[p] = best;
    ANG[p] = atan2(a * best, D0 - best);
    AUX[p] = aux;
  }

// A skeleton horse in its own frame: forward f, up u, out s, as bones
// [f, u, s, f, u, s, r, r]. Legs are added each frame as they gallop.
const SC = 1.45;
const BONES = [
  [-0.2, 0.03, 0, 0.12, 0.06, 0, 0.024, 0.022],
  [0.12, 0.06, 0, 0.2, 0.19, 0, 0.028, 0.022],
  [0.19, 0.22, 0, 0.33, 0.12, 0, 0.055, 0.03],
  [0.19, 0.24, 0.02, 0.17, 0.31, 0.02, 0.016, 0.008],
  [-0.17, 0.04, 0, -0.25, -0.05, 0, 0.032, 0.02],
  [-0.07, -0.1, 0, 0.09, -0.09, 0, 0.012, 0.012],
  [-0.25, 0.02, 0, -0.32, -0.03, 0, 0.013, 0.011],
  [-0.32, -0.03, 0, -0.35, -0.15, 0, 0.011, 0.008],
];
for (const f of [-0.08, -0.03, 0.02, 0.07]) for (const s of [-0.055, 0.055]) BONES.push([f, 0.04, s, f + 0.015, -0.09, s * 1.1, 0.012, 0.01]);
// A rider, sitting astride with both hands on the pole.
const RIDER = [
  [-0.02, 0.09, 0, 0.02, 0.33, 0, 0.075, 0.06],
  [0.03, 0.3, 0.05, 0.01, 0.24, 0.02, 0.026, 0.02],
  [0.03, 0.3, -0.05, 0.01, 0.24, -0.02, 0.026, 0.02],
  [-0.02, 0.1, 0.06, 0.07, -0.07, 0.08, 0.036, 0.024],
  [-0.02, 0.1, -0.06, 0.07, -0.07, -0.08, 0.036, 0.024],
  [-0.02, 0.22, 0, -0.17, 0.27, 0, 0.045, 0.01],
];

export function setup(params) {
  params.s = {
    t: 0, th: 0.35, lurch: -99, next: 4, L: 0, flash: 0, hue: -1, speed: 2, horses: 5, fog: 0.06,
    buf: new Float32Array(N * 3), zb: new Float32Array(N), bg: new Float32Array(N * 3), ga: new Float32Array(N), ge: new Uint8Array(N),
  };
}

// The sky and the far fairground for a hue: a night deepening upward over a
// glow at the horizon, a moon, stars, and the black shapes of a big wheel
// and a tent that show between the horses.
function sky(S) {
  const h = 0.76 - 0.36 * S.hue, bg = S.bg;
  S.night = hsv(h, 0.75, 0.42);
  S.fogc = hsv(h + 0.04, 0.3, 0.62);
  S.dark = hsv(h, 0.8, 0.17);
  S.top = hsv(h + 0.12, 0.88, 0.75);
  S.panel = hsv(h + 0.02, 0.82, 0.36);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const u = cl(y / 64, 0, 1), v = round((0.1 + 0.45 * u * u) * 24) / 24;
      let c = hsv(h + 0.06 * u, 0.8 - 0.2 * u, v);
      const dx = x + 0.5 - 11, dy = y + 0.5 - 13, dm = sqrt(dx * dx + dy * dy);
      if (dm < 7.5) {
        const cr = Math.hypot(dx + 2, dy - 1.5) < 2.2 || Math.hypot(dx - 2.5, dy + 2.5) < 1.4;
        c = cr ? [0.78, 0.76, 0.66] : [0.98, 0.95, 0.8];
      } else if (dm < 10.5) c = mix(c, [0.8, 0.75, 0.9], dm < 9 ? 0.25 : 0.12);
      else if (y < 50 && hash(p * 7 + 3) < 0.012) c = [0.75, 0.75, 0.85];
      // The big wheel on the right and a tent on the left, black.
      const wx = x + 0.5 - 54, wy = y + 0.5 - 42, wr = Math.hypot(wx, wy), wa = atan2(wy, wx);
      const wheel = (abs(wr - 17) < 0.7 || (wr < 17 && abs(fr((wa * 8) / TAU + 0.5) - 0.5) * wr < 0.45)) && y < 64;
      const legs = y > 42 && y < 64 && abs(abs(x + 0.5 - 54) - (y - 42) * 0.35) < 0.6;
      const tent = y > 45 && y < 64 && abs(x + 0.5 - 6) < (y - 45) * 0.75 + 0.5;
      if (wheel || legs || tent) c = [0.03, 0.01, 0.05];
      bg.set(c, 3 * p);
    }
}

// Paint a tapered capsule between two projected points, keeping the nearest.
function capsule(S, A, B, ra, rb, rim, col, ghost) {
  const { buf, zb, ga } = S;
  const pa = (ra * F) / A[2], pb = (rb * F) / B[2], ex = B[0] - A[0], ey = B[1] - A[1], e2 = ex * ex + ey * ey || 1e-6, pad = max(pa, pb) + rim + 1;
  for (let y = max(0, floor(min(A[1], B[1]) - pad)); y <= min(H - 1, floor(max(A[1], B[1]) + pad)); y++)
    for (let x = max(0, floor(min(A[0], B[0]) - pad)); x <= min(W - 1, floor(max(A[0], B[0]) + pad)); x++) {
      const qx = x + 0.5 - A[0], qy = y + 0.5 - A[1], u = cl((qx * ex + qy * ey) / e2, 0, 1), dx = qx - u * ex, dy = qy - u * ey;
      const d = sqrt(dx * dx + dy * dy), pr = max(0.55, pa + (pb - pa) * u) + rim, p = y * W + x;
      if (d >= pr) continue;
      const w = ra + (rb - ra) * u, z = A[2] + (B[2] - A[2]) * u - (rim ? -0.04 : w * sqrt(1 - (d / pr) ** 2));
      if (z >= zb[p]) continue;
      if (ghost) {
        ga[p] = max(ga[p], ghost * (1 - 0.45 * (d / pr) ** 2));
        continue;
      }
      zb[p] = z;
      const l = rim ? 1 : 0.78 + 0.22 * (1 - d / pr);
      buf[3 * p] = col[0] * l;
      buf[3 * p + 1] = col[1] * l;
      buf[3 * p + 2] = col[2] * l;
    }
}

// One bulb: a hot core and a small halo, if nothing nearer hides it.
function bulb(S, P, col, b) {
  const x = floor(P[0]), y = floor(P[1]), p = y * W + x;
  if (x < 0 || x >= W || y < 0 || y >= H || P[2] > S.zb[p] + 0.03) return;
  const { buf } = S;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const xx = x + i, yy = y + j, d = i * i + j * j;
      if (xx < 0 || xx >= W || yy < 0 || yy >= H || d > 5) continue;
      const q = 3 * (yy * W + xx), g = d === 0 ? 1.2 * b : (d < 2 ? 0.32 : d < 3 ? 0.14 : 0.06) * b;
      buf[q] += col[0] * g;
      buf[q + 1] += col[1] * g;
      buf[q + 2] += col[2] * g;
    }
  if (b > 0.5) buf.set(mix(col, [1, 1, 1], 0.5), 3 * p);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) (S.hue = hue), sky(S);
  S.speed = cl(k[1], 0.2, 3);
  S.horses = round(cl(k[2], 5, 8));
  S.fog = cl(k[3], -1, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  if ((input.btnPressed && input.btnPressed[0] && S.t - S.lurch > 3.2) || S.t >= S.next) (S.lurch = S.t), (S.next = S.t + 17);
  // The lurch: a jolt up to speed in 0.35 s, three seconds of green, three to slow.
  const lt = S.t - S.lurch;
  S.L = lt < 0.35 ? sm(lt / 0.35) : lt < 3.2 ? 1 : 1 - sm((lt - 3.2) / 3);
  S.flash = lt < 0.4 ? 1 - lt / 0.4 : 0;
  S.th += ds * 0.42 * (1 + 1.5 * S.L);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.night) return;
  const { buf, zb, bg, ga, ge, th, L } = S;
  const bc = mix([1, 0.55, 0.12], [0.35, 1, 0.25], L), glowc = mix(bc, [1, 1, 1], S.flash * 0.6);
  const night = S.night, dark = S.dark, t = S.t;
  zb.set(DEP);
  for (let p = 0; p < N; p++) {
    const kd = KIND[p], a = ANG[p] - th, h = AUX[p], q = 3 * p;
    let c;
    if (kd === SKY) {
      buf[q] = bg[q];
      buf[q + 1] = bg[q + 1];
      buf[q + 2] = bg[q + 2];
      continue;
    } else if (kd === CONE) {
      // Eighteen stripes, the bright ones lit by the bulbs below and going
      // from the bulb colour at the rim to magenta and the night at the top.
      const up = (h - VT) / (HA - VT), face = 0.7 + 0.3 * cos(ANG[p]);
      c = floor(fr(a / TAU) * 18) % 2 ? mix(mix(bc, S.top, sm(up * 1.6)), night, sm(up * 1.3 - 0.3)) : mix(dark, [0.05, 0.01, 0.06], up);
      c = c.map((v) => v * face);
    } else if (kd === VAL) {
      const tooth = 0.07 * (1 - abs(2 * fr((a * 36) / TAU) - 1));
      c = h > 0.975 || h < 0.812 ? [0.95, 0.7, 0.25] : h < VB + tooth ? mix(bc, [0.8, 0.2, 0.5], 0.3) : [0.12, 0.03, 0.15];
    } else if (kd === CEIL) c = fr((a * 12) / TAU) < 0.1 ? [0.55, 0.38, 0.12] : mix([0.2, 0.05, 0.18], bc, 0.25 * h);
    else if (kd === VIN) c = h > 0.98 || h < 0.82 ? [0.45, 0.3, 0.1] : [0.07, 0.02, 0.09];
    else if (kd === FIN) c = [0.95, 0.75, 0.3];
    else if (kd === COL) {
      // Eight panels round the column, mirrors between gilt frames; a mirror
      // catches the bulbs as it turns toward us.
      const f = fr((a * 8) / TAU), face = cos(ANG[p]);
      c = h > 0.86 || h < -0.86 || f < 0.12 ? [0.85, 0.62, 0.2] : floor((a * 8) / TAU) % 2 ? mix([0.3, 0.26, 0.45], bc, 0.6 * max(0, face) ** 3 + 0.1) : [0.08, 0.12, 0.1];
      c = c.map((v) => v * (0.55 + 0.45 * max(0, face)));
    } else if (kd === TOPS) c = mix(floor((a * 12) / TAU) % 2 ? [0.2, 0.14, 0.24] : [0.13, 0.08, 0.17], bc, 0.1 + 0.15 * h);
    else if (kd === SIDE) {
      const f = fr((a * 16) / TAU);
      c = h > PT - 0.015 || h < PG + 0.015 ? [0.85, 0.6, 0.2] : f < 0.5 ? S.panel : [0.12, 0.03, 0.14];
    } else {
      // Ground: dark earth, warm near the platform from the bulbs.
      const g = round(6 * exp(-(h - RF) * 2.4)) / 6, far = cl((h - 4) / 20, 0, 1);
      c = mix(mix([0.06, 0.04, 0.08], bc, 0.3 * g), bg.slice(q, q + 3), far);
    }
    buf[q] = c[0];
    buf[q + 1] = c[1];
    buf[q + 2] = c[2];
  }
  // Poles, horses and riders, ring order does not matter with the depths.
  const n = S.horses, legs = [], ghost = sm(L * 1.6 - 0.4);
  ga.fill(0);
  ge.fill(0);
  for (let i = 0; i < n; i++) {
    const ph = th + (TAU * i) / n, sp = sin(ph), cp = cos(ph), bob = 3 * th + i * PI;
    const hb = -0.33 + 0.09 * sin(bob), sw = 0.035 * sin(bob + 0.8);
    const at = (f, u, s) => proj(RP * sp + SC * (f * cp + s * sp), hb + SC * u, RP * cp + SC * (-f * sp + s * cp));
    // Brass pole, twisted: bright bands climb it as it turns.
    const P0 = proj(RP * sp, PT, RP * cp), P1 = proj(RP * sp, VT, RP * cp), hw = max(0.5, (0.028 * F) / P0[2]), dim = 1 - (0.42 * (P0[2] - 4.2)) / 1.56;
    for (let y = max(0, floor(P1[1])); y <= min(H - 1, floor(P0[1])); y++)
      for (let x = max(0, round(P0[0] - hw)); x < min(W, round(P0[0] + hw)); x++) {
        const p = y * W + x;
        if (P0[2] >= zb[p]) continue;
        zb[p] = P0[2];
        const l = dim * (0.72 + 0.28 * sin(y * 1.1 + th * 9 + x));
        buf.set([0.98 * l, 0.74 * l, 0.28 * l], 3 * p);
      }
    // The skeleton: a dark rim round every bone first, then the bones.
    legs.length = 0;
    for (const s of [-0.045, 0.045]) {
      const g = s > 0 ? sw : -sw;
      legs.push([0.1, -0.03, s, 0.18 + g, -0.13, s, 0.019, 0.017], [0.18 + g, -0.13, s, 0.13 + 1.5 * g, -0.24, s, 0.017, 0.015]);
      legs.push([-0.19, -0.02, s, -0.25 - g, -0.14, s, 0.021, 0.017], [-0.25 - g, -0.14, s, -0.35 - 1.5 * g, -0.22, s, 0.017, 0.015]);
    }
    const bone = mix(mix([0.95, 0.92, 0.8], [0.55, 1, 0.5], 0.25 * L), night, 0.5 * (1 - dim));
    for (const rim of [0.9, 0])
      for (const B of [...BONES, ...legs]) capsule(S, at(B[0], B[1], B[2]), at(B[3], B[4], B[5]), SC * B[6], SC * B[7], rim, rim ? [0.02, 0, 0.03] : bone.map((v) => v * dim), 0);
    // Hollow eye sockets, wherever the skull faces us.
    for (const s of [-0.045, 0.045]) {
      const E = at(0.235, 0.2, s), r = max(0.75, (0.026 * SC * F) / E[2]);
      for (let y = floor(E[1] - r); y <= E[1] + r; y++)
        for (let x = floor(E[0] - r); x <= E[0] + r; x++) {
          const p = y * W + x;
          if (x < 0 || x >= W || y < 0 || y >= H || Math.hypot(x + 0.5 - E[0], y + 0.5 - E[1]) > r || E[2] - 0.07 > zb[p]) continue;
          buf.set([0.02, 0, 0.03], 3 * p);
        }
    }
    if (ghost > 0.01) {
      for (const B of RIDER) capsule(S, at(B[0], B[1], B[2]), at(B[3], B[4], B[5]), SC * B[6], SC * B[7], 0, null, ghost * dim);
      const Hc = at(0.04, 0.44, 0), hr = (0.085 * SC * F) / Hc[2];
      capsule(S, Hc, Hc, 0.085 * SC, 0.085 * SC, 0, null, ghost * dim);
      // The rider turns its face to us: two dark eyes.
      for (const dx of [-0.42, 0.42]) {
        const x = floor(Hc[0] + dx * hr);
        for (let y = floor(Hc[1] - 0.35 * hr); y <= Hc[1] + 0.25 * hr; y++) if (x >= 0 && x < W && y >= 0 && y < H && Hc[2] < zb[y * W + x] + 0.1) ge[y * W + x] = 1;
      }
    }
  }
  // Bulbs: round the valance, under the canopy, on the column and round the
  // platform's edge, each flickering on its own.
  const lamp = (j, P) => {
    let b = 0.82 + 0.18 * sin(t * (6 + (j % 5)) + j * 1.7);
    if (hash(j * 131 + floor(t * 2.5)) < 0.05) b = 0.25;
    b = min(1.4, b * (1 + S.flash));
    bulb(S, P, glowc, b);
  };
  for (let j = 0; j < 28; j++) {
    const a = th + (TAU * j) / 28;
    lamp(j, proj(1.005 * sin(a), 0.9, 1.005 * cos(a)));
    if (j < 16) lamp(j + 40, proj(0.62 * sin(a * 1.75), 0.995, 0.62 * cos(a * 1.75)));
    if (j < 24) lamp(j + 80, proj(1.055 * sin(a * 1.1667), -1.01, 1.055 * cos(a * 1.1667)));
    if (j < 14) lamp(j + 120, proj(0.2 * sin(a * 2), j % 2 ? 0.62 : -0.62, 0.2 * cos(a * 2)));
  }
  // Riders: pale green and half see-through, with dark eyes.
  if (ghost > 0.01)
    for (let p = 0; p < N; p++) {
      const g = ga[p], q = 3 * p;
      if (!g) continue;
      const c = ge[p] ? [0, 0.06, 0.02] : [0.62, 1, 0.66];
      for (let i = 0; i < 3; i++) buf[q + i] = buf[q + i] * (1 - 0.75 * g) + c[i] * 0.75 * g;
    }
  // Ground fog, its top edge rolling sideways and wisps drifting through it.
  const u = (S.fog + 1) / 2, top = 129 - 58 * u, dens = 0.7 * sm(u * 2.2), fc = mix(S.fogc, bc, 0.12);
  for (let x = 0; x < W; x++) {
    const yt = top + 3 * sin(x * 0.16 + t * 0.7) + 2 * sin(x * 0.37 - t * 1.1);
    for (let y = max(0, floor(yt)); y < H; y++) {
      const wisp = 0.62 + 0.38 * sin(x * 0.21 + y * 0.43 - t * 1.3) * sin(x * 0.13 - y * 0.19 + t * 0.8);
      const a = round(dens * sm((y - yt) / 16) * wisp * 8) / 8, q = 3 * (y * W + x);
      if (!a) continue;
      for (let i = 0; i < 3; i++) buf[q + i] = buf[q + i] * (1 - a) + fc[i] * a;
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) display.setPixel(x, y, round(cl(buf[3 * p], 0, 1) * 255), round(cl(buf[3 * p + 1], 0, 1) * 255), round(cl(buf[3 * p + 2], 0, 1) * 255));
}
