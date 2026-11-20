// ===== Patternflow pattern =====
// Title:   Fata Morgana
// Family:  mirage
// Idea:    A far coast of mesas and spires seen over cold water at dawn, lifted and stacked into erect and upside-down copies, with bright folds between them, because two thin layers of warm air bend every ray from the eye.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the superior mirage named for Morgan le Fay and seen over the Strait of Messina; mirages as refraction in air of changing density (Gaspard Monge, 1798); rays traced through a thin warm layer (William Lehn, 1979, from memory); pattern round 203
// Round:   203
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.2..3, Inversion=-1..1, Range=-1..1
//
// Knob 1: Hue. Turns the whole picture round the colour wheel, so the dawn it opens on (gold horizon, rose, violet, deep blue, teal water) moves through green and blue evenings and back to itself at 1.
// Knob 2: Drift. How fast the coast slides along the horizon and the warm layers rise and thin: at 0.2 it crawls under a fifth of an LED a second and a stack takes minutes to change, at 3 it slides nearly 3 LEDs a second and the stack folds over in half a minute.
// Knob 3: Inversion. How hard the warm layers bend the rays: at -1 the air is nearly plain and the coast is a few stubs on the horizon, where it opens (0) one layer pair hangs the coast upside down above itself on stretched legs, at 1 the hanging slab is thicker and a second turned copy shows under it.
// Knob 4: Range. How far away the coast is, from 14 km at -1 to 90 km at 1: near, it stands on the horizon under its own upside-down copy; far, only the lifted pieces show, fewer and higher, and they float clear of the water.

const W = 64;
const H = 128;
const { floor, sin, cos, sqrt, exp, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Earth and air. A ray's height above the sea obeys z'' = 1/R - k(z): the
// sea falls away at 1/R, the ray bends down at k. Standard air bends it at a
// quarter of 1/R; a thin layer of warm air adds a bump of extra bending, and a
// ray that meets it nearly level is bent so hard it turns back.
const R = 6.371e6;
const K_STD = 0.25 / R;
const STEPS = 72;
const SUB = 2;
// One LED row is 0.000165 rad of elevation; the sea's edge sits on row 72.
const DE = 0.000165;
const HOR_ROW = 72;
const EPS_DIP = -0.00137;

// A smooth 1-D noise that never repeats: lattice values hashed from the cell.
function hash(i) {
  let h = (Math.imul(i | 0, 374761393) + 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
function vnoise(x) {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(hash(i), hash(i + 1), u);
}

// The coast at its own distance: height in metres above the sea at LED x.
// Mesas are flat tops cut from a soft noise; spires stand narrow on top.
function coast(x) {
  const n = 0.5 * vnoise(x / 7) + 0.32 * vnoise(x / 3.7 + 11) + 0.18 * vnoise(x / 2.2 + 5);
  const mesa = sstep(-0.4, 0.4, n);
  let h = 28 + 130 * mesa;
  // Spires: tall narrow towers, about one cell in three, three LEDs across at the foot.
  const s = vnoise(x / 4.4 + 37);
  if (s > 0.35) h += 90 * ((s - 0.35) / 0.65) ** 0.9;
  return h;
}

const BASALT = [0.15, 0.09, 0.2], RUST = [0.6, 0.27, 0.17], OCHRE = [0.9, 0.6, 0.28], SAND = [0.95, 0.82, 0.66];

// Gradient stops: position, r, g, b.
const SKY = [
  [0, 1.0, 0.8, 0.52],
  [0.16, 0.96, 0.52, 0.5],
  [0.45, 0.5, 0.28, 0.58],
  [1, 0.1, 0.13, 0.4],
];
function grad(stops, t, o) {
  t = cl(t, 0, 1);
  let k = 0;
  while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
  const a = stops[k], b = stops[k + 1];
  const u = sstep(0, 1, (t - a[0]) / (b[0] - a[0]));
  o[0] = mix(a[1], b[1], u);
  o[1] = mix(a[2], b[2], u);
  o[2] = mix(a[3], b[3], u);
}

export function setup(params) {
  params.s = {
    t: 110, scroll: 100, wz: 0, wa: 0, hue: 0, speed: 1, inv: 0.5, D: 52000,
    ray: Array.from({ length: H * SUB }, () => ({ kind: 0, z: 0, a: 0, sh: 0, m: 1 })),
    tab: new Float32Array(2 * (W + 12) + 2),
    buf: new Float32Array(W * H * 3),
    c: [0, 0, 0], c2: [0, 0, 0], hz: [0, 0, 0],
  };
}

const gauss = () => sqrt(-2 * Math.log(1 - Math.random())) * cos(2 * PI * Math.random());

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3) / 2;
  S.inv = cl((k[2] + 1) / 2, 0, 1);
  S.D = (52 + 38 * cl(k[3], -1, 1)) * 1000;
  const sd = dt * S.speed;
  S.t += sd * 1.7;
  S.scroll += sd * (1.9 + 0.7 * sin(0.113 * S.t));
  // Two slow random walks the sines do not have, pulled back so they stay in range.
  S.wz += -0.04 * S.wz * sd + 0.9 * sqrt(sd) * gauss();
  S.wa += -0.05 * S.wa * sd + 0.02 * sqrt(sd) * gauss();
}

// Trace every sub-row's ray from the eye to the coast's range.
function trace(S) {
  const t = S.t, D = S.D, ds = D / STEPS;
  // Observer height, two warm layers (height, extra bending, thickness). The
  // layers grow with the range so the stack keeps its shape at every distance,
  // and a shorter path needs a harder bend to turn the same rays.
  const h0 = 8 + 2.5 * sin(0.045 * t + 0.7);
  const zs = (D / 52000) ** 0.8, hard = 52000 / D;
  const u = S.inv, s = 0.2 + 0.8 * (1 - (1 - u) ** 3);
  const zi1 = (140 + 17 * sin(0.071 * t + 1.3) + 9 * sin(0.0317 * t) + 3 * S.wz) * zs;
  const w1 = (28 + 6 * sin(0.037 * t + 2)) * zs;
  // The hardest bend a layer of this height and thickness can give before it
  // throws the rays back into the sea (found by bisection at 52 km): the stack sits
  // just under that edge, so it folds and never floods.
  const dz = zi1 / zs - 90;
  const edge = (0.54 + 0.0072 * dz + 0.000005 * dz * dz) * (28 / (w1 / zs)) ** 0.55 * 1e-6;
  const A1 = edge * hard * (0.8 + 0.2 * min(1, D / 52000)) * s * cl(0.93 + 0.03 * sin(0.043 * t + 2.2) + 0.02 * sin(0.0197 * t) + S.wa, 0.86, 0.97);
  const zi2 = zi1 + (78 + 22 * sin(0.026 * t + 0.5) + 8 * sin(0.0113 * t)) * zs;
  const A2 = 0.66 * A1 * (1 + 0.3 * sin(0.051 * t + 4));
  const w2 = 24 * zs;
  const kmax = 1 / R;
  for (let r = 0; r < H * SUB; r++) {
    const row = (r + 0.5) / SUB - 0.5;
    const eps = EPS_DIP + (HOR_ROW - row) * DE;
    const o = S.ray[r];
    let z = h0, th = eps, hit = -1;
    for (let i = 0; i < STEPS; i++) {
      const zm = z + 0.5 * th * ds;
      const u1 = abs(zm - zi1) / w1, u2 = abs(zm - zi2) / w2;
      const e1 = exp(-2 * u1), e2 = exp(-2 * u2);
      const kk = K_STD + A1 * (4 * e1) / ((1 + e1) * (1 + e1)) + A2 * (4 * e2) / ((1 + e2) * (1 + e2));
      const a = kmax - kk;
      const zn = z + th * ds + 0.5 * a * ds * ds;
      th += a * ds;
      if (zn < 0) {
        hit = (i + z / (z - zn)) * ds;
        break;
      }
      z = zn;
    }
    if (hit >= 0) {
      o.kind = 0;
      o.sh = cl(hit / 8000, 0, 1);
    } else {
      o.kind = 1;
      o.z = z;
      o.a = th - D * (kmax - K_STD);
    }
  }
  // Slope of height against elevation, in units where a plain view is 1: near zero
  // is a fold, where the picture turns over.
  for (let r = 0; r < H * SUB; r++) {
    const a = S.ray[max(0, r - 1)], b = S.ray[min(H * SUB - 1, r + 1)], o = S.ray[r];
    o.m = a.kind === 1 && b.kind === 1 && o.kind === 1 ? (b.z - a.z) / (2 * (DE / SUB) * D) : 9;
  }
  // The coast stands as tall as the layer is high, so a rising layer lifts towers rather than hiding them.
  return { zs: (D / 52000) * (zi1 / zs / 140) ** 0.8 };
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { zs } = trace(S);
  const t = S.t, D = S.D, c = S.c, c2 = S.c2, hz = S.hz;
  // The hue wheel as a rotation about grey.
  const ang = 2 * PI * S.hue, ca = cos(ang), sa = sin(ang) / sqrt(3), q = (1 - ca) / 3;
  const m00 = ca + q, m01 = q - sa, m02 = q + sa;
  // The coast and the sun hold their place on the screen while the coast slides.
  const sunX = 26 + 9 * sin(0.021 * t + 1) + 4 * sin(0.0073 * t);
  const sunT = 0.1;
  const far = D / 90000;
  grad(SKY, 0.1, hz);
  // Height of the coast along the screen row, a table with half-LED steps.
  const tab = S.tab, x0 = S.scroll - 6;
  for (let i = 0; i < tab.length; i++) tab[i] = coast(x0 + i * 0.5) * zs;
  const tx = (x) => {
    const f = (x - x0) * 2, i = cl(floor(f), 0, tab.length - 2);
    return mix(tab[i], tab[i + 1], cl(f - i, 0, 1));
  };
  for (let y = 0; y < H; y++) {
    const r0 = y * SUB;
    for (let x = 0; x < W; x++) {
      let R_ = 0, G_ = 0, B_ = 0;
      for (let sub = 0; sub < SUB; sub++) {
        const o = S.ray[r0 + sub];
        if (o.kind === 0) {
          // Sea: dark and teal near, pale with the sky far.
          const sh = o.sh;
          grad(SKY, 0.05 + 0.25 * (1 - sh), c2);
          const refl = 0.1 + 0.62 * sh ** 1.5 + 0.4 * exp(-max(0, y - HOR_ROW) / 7);
          let r = mix(0.01, c2[0] * 0.8, refl), g = mix(0.2, c2[1] * 0.8, refl), b = mix(0.34, c2[2] * 0.8, refl);
          const dx = x - sunX, sg = 2.4 + 9 * (1 - sh);
          const gl = 0.6 * exp(-(dx * dx) / (sg * sg)) * (0.6 + 0.4 * vnoise(y * 0.5 + t * 0.9)) * (0.75 + 0.25 * vnoise(x * 0.17 + t * 0.5)) * (0.4 + 0.6 * sh);
          r += gl * 1.0; g += gl * 0.8; b += gl * 0.5;
          c[0] = r; c[1] = g; c[2] = b;
        } else {
          // Shimmer: a row-wise sideways wobble that grows near folds.
          const wob = (0.5 + 1.6 * exp(-(o.m * o.m) / 0.06)) * vnoise(y * 0.31 + t * 1.3) * 1.2;
          const hgt = tx(x + S.scroll + wob);
          const hit = o.z <= hgt && o.z >= 0;
          if (hit) {
            // Coast: strata by height, a pale cap, haze with the range.
            const z = o.z;
            const band = floor(z / (17 * zs) + 0.8 * vnoise((x + S.scroll) / 9));
            // Four kinds of band, hashed from the band's number: basalt, rust, ochre, pale sand.
            const u = hash(band * 7 + 3) * 0.5 + 0.5;
            const bc = u < 0.22 ? BASALT : u < 0.62 ? RUST : u < 0.86 ? OCHRE : SAND;
            let r = bc[0], g = bc[1], b = bc[2];
            const cap = sstep(0, 1, 1 - (hgt - z) / (7 * zs));
            r = mix(r, 0.92, cap * 0.8); g = mix(g, 0.82, cap * 0.8); b = mix(b, 0.76, cap * 0.8);
            const hh = 0.14 + 0.2 * far;
            c[0] = mix(r, hz[0] * 0.9, hh); c[1] = mix(g, hz[1] * 0.85, hh); c[2] = mix(b, hz[2] * 0.9, hh);
          } else {
            // Sky, by the angle the ray leaves with; the sun's glow is part of it.
            const rt = (HOR_ROW - (y + 0.5)) / (HOR_ROW * 0.9);
            const tt = rt + cl(0.5 * ((o.a - EPS_DIP) / (HOR_ROW * DE * 0.9) - rt), -0.22, 0.22);
            grad(SKY, tt, c);
            const dx = x - sunX;
            const gl = 0.9 * exp(-(dx * dx) / 49 - ((tt - sunT) * (tt - sunT)) / 0.0081) + 0.25 * exp(-(dx * dx) / 480 - ((tt - sunT) * (tt - sunT)) / 0.09);
            c[0] += gl; c[1] += gl * 0.82; c[2] += gl * 0.58;
            // High cirrus lit from below: soft streaks that drift with the coast, thickest well above the horizon.
            const cw = sstep(0.1, 0.5, vnoise(x * 0.09 - t * 0.4 + 4 * vnoise(y * 0.15 + 3)) * 0.5 + 0.5 + 0.3 * vnoise(x * 0.2 + t * 0.25 + 6 * vnoise(y * 0.08 + 9))) * sstep(0.05, 0.4, tt) * (1 - 0.6 * tt);
            c[0] += 0.15 * cw * (1 - c[0]); c[1] += 0.09 * cw * (1 - c[1]); c[2] += 0.06 * cw * (1 - c[2]);
          }
          // Bright folds: a warm light along the turn of the picture, strong on the coast.
          const rim = (hit ? 0.34 : 0.1) * exp(-(o.m * o.m) / 0.03);
          c[0] += rim * (1 - c[0]) * 0.9; c[1] += rim * (1 - c[1]) * 0.8; c[2] += rim * (1 - c[2]) * 0.6;
        }
        R_ += c[0]; G_ += c[1]; B_ += c[2];
      }
      R_ /= SUB; G_ /= SUB; B_ /= SUB;
      const bi = (y * W + x) * 3;
      if (y > HOR_ROW) {
        // The water gives back the picture above the horizon, rippled sideways and fading with depth.
        const d = y - HOR_ROW, yy = 2 * HOR_ROW + 1 - y;
        const fx = cl(x + (1.2 + 0.05 * d) * vnoise(y * 0.45 + t * 0.8), 0, W - 1), ix = min(W - 2, floor(fx)), fr = fx - ix;
        const w = 0.6 * exp(-d / 40), j0 = (yy * W + ix) * 3, j1 = j0 + 3;
        R_ = mix(R_, mix(S.buf[j0], S.buf[j1], fr) * 0.55, w);
        G_ = mix(G_, mix(S.buf[j0 + 1], S.buf[j1 + 1], fr) * 0.8, w);
        B_ = mix(B_, mix(S.buf[j0 + 2], S.buf[j1 + 2], fr) * 1.0, w);
        // A long swell, rolling toward the eye and a little stronger the nearer it gets.
        const sw = 1 + (0.07 + 0.0006 * d) * sin(y * 0.33 - t * 1.7 + 2 * vnoise(x * 0.07 + t * 0.1));
        R_ *= sw; G_ *= sw; B_ *= sw;
      }
      S.buf[bi] = R_; S.buf[bi + 1] = G_; S.buf[bi + 2] = B_;
      const r = m00 * R_ + m01 * G_ + m02 * B_, g = m02 * R_ + m00 * G_ + m01 * B_, b = m01 * R_ + m02 * G_ + m00 * B_;
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(g, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
  }
}
