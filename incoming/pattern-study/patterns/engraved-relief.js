// ===== Patternflow pattern =====
// Title:   Engraved Relief
// Family:  engraving
// Idea:    A drifting landscape of domes, ridges and saddles is engraved in nothing but horizontal lines, each line bent by the height beneath it and swelling or thinning with the light that falls on it, so the solid form reads by line weight alone.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 228, after the engraved line screen of banknote and etching portraits (displaced parallel lines with a width that follows the tone)
// Round:   230
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Height=0.5..3, Pitch=-1..1, Light=18..70
//
// Knob 1: Hue. Turns the ink and the ground round the wheel together from the opening warm ivory on deep indigo.
// Knob 2: Height. How far the lines are bent, from half a line pitch to three pitches; it opens at 2.
// Knob 3: Pitch. The gap between line centres, 6.3 LEDs at 0, about 4.3 at -1 and 9.1 at 1.
// Knob 4: Light. How high the lamp stands above the ground in degrees: 18 rakes the relief into thick lit lines and thin shadowed ones, 70 flattens the lighting to the steep flanks alone.

const W = 64;
const H = 128;
const TAU = Math.PI * 2;
const { floor, sqrt, exp, sin, cos, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const NSRC = 9;
const SLOPE = 0.5;
// Sources live on a frame a little larger than the panel so a hill can slide in from outside.
const FX0 = -6, FX1 = W + 6, FY0 = -8, FY1 = H + 8;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// One hill is born at random, lives 40 to 120 s with a smooth rise and fall, and is replaced by another,
// so the landscape is never the one it was and nothing counts the time. The two big ones, the basin, live twice as long
// and move half as fast.
function born(s, age, all) {
  const r = Math.random();
  const big = !!s.big;
  // 0 dome, 1 ridge, 2 saddle, 3 pit, 4 knoll (a small dome that roughens the ground)
  s.kind = big ? (r < 0.5 ? 0 : 3) : r < 0.3 ? 0 : r < 0.52 ? 1 : r < 0.66 ? 2 : r < 0.78 ? 3 : 4;
  // Of five random places take the one farthest from every other hill, so the panel is never left bare in one corner.
  let best = -1;
  for (let c = 0; c < 5; c++) {
    const cx = FX0 + (FX1 - FX0) * Math.random(), cy = FY0 + (FY1 - FY0) * Math.random();
    let near = 1e9;
    for (const o of all) if (o !== s && o.life) near = min(near, (o.x - cx) * (o.x - cx) + (o.y - cy) * (o.y - cy));
    if (near > best) (best = near), (s.x = cx), (s.y = cy);
  }
  const v = 0.25 + 0.75 * Math.random(), a = TAU * Math.random();
  s.vx = v * cos(a) * (big ? 0.5 : 1);
  s.vy = v * sin(a) * (big ? 0.5 : 1);
  s.ang = TAU * Math.random();
  s.spin = (Math.random() - 0.5) * 0.06;
  s.life = big ? 120 + 120 * Math.random() : 40 + 80 * Math.random();
  s.age = age;
  s.amp = (s.kind === 4 ? 0.3 + 0.2 * Math.random() : big ? 0.7 + 0.4 * Math.random() : 1.0 + 0.5 * Math.random()) * (s.kind === 3 ? -0.8 : 1);
  s.su = big ? 24 + 12 * Math.random() : s.kind === 1 ? 22 + 12 * Math.random() : s.kind === 4 ? 6 + 3 * Math.random() : 9 + 6 * Math.random();
  s.sv = big ? s.su : s.kind === 1 ? 6.5 + 3 * Math.random() : s.su;
  return s;
}

export function setup(params) {
  const S = {
    t: 0,
    src: [],
    // light azimuth and hue wander phases
    lp: [TAU * Math.random(), TAU * Math.random(), TAU * Math.random()],
    hp: [TAU * Math.random(), TAU * Math.random()],
    k: [0, 2, 0, 18],
    c: [new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)],
    g: new Float32Array(3),
    nz: new Float32Array(64),
    use: 1,
  };
  for (let i = 0; i < NSRC; i++) {
    const s = { big: i < 2, x: 0, y: 0 };
    S.src.push(born(s, 0, S.src));
    s.age = s.life * Math.random();
  }
  for (let i = 0; i < S.nz.length; i++) S.nz[i] = Math.random() * 2 - 1;
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  dt = min(dt || 0, 0.1);
  S.t += dt;
  const kv = input.knobValues || [0, 2, 0, 18];
  S.k[0] = kv[0];
  S.k[1] = cl(kv[1], 0.5, 3);
  S.k[2] = cl(kv[2], -1, 1);
  S.k[3] = cl(kv[3], 18, 70);
  for (let i = 0; i < S.src.length; i++) {
    const s = S.src[i];
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.ang += s.spin * dt;
    if (s.age >= s.life) born(s, 0, S.src);
  }
}

// Per-frame source constants, packed flat for the pixel loop.
const SC = new Float32Array(NSRC * 9);
const PROBE = new Float32Array(800);

// The height field and its gradient at one point, left in FH, FX, FY. The sources and the basin share it with the
// slope probe, so what the probe measures is what the lines then bend by.
let FH = 0, FX = 0, FY = 0;
function field(x, y) {
  let h = 0, hx = 0, hy = 0;
  for (let i = 0; i < NSRC; i++) {
    const o = i * 9;
    const a = SC[o + 6];
    if (a === 0) continue;
    const dx = x - SC[o], dy = y - SC[o + 1];
    const c = SC[o + 2], s = SC[o + 3];
    const u = c * dx + s * dy, v = c * dy - s * dx;
    const iu = SC[o + 4], iv = SC[o + 5];
    const q = 0.5 * (u * u * iu + v * v * iv);
    if (q > 9) continue;
    const E = exp(-q);
    let gu, gv;
    if (SC[o + 7] === 2) {
      // saddle: u*v under a round gaussian, scaled so its peak is a
      const g = a * 2.718 * E * iu;
      h += g * u * v;
      gu = g * v * (1 - u * u * iu);
      gv = g * u * (1 - v * v * iu);
    } else {
      const g = a * E;
      h += g;
      gu = -g * u * iu;
      gv = -g * v * iv;
    }
    hx += c * gu - s * gv;
    hy += s * gu + c * gv;
  }
  FH = h;
  FX = hx;
  FY = hy;
}

export function draw(display, params) {
  const S = params.s;
  const t = S.t;
  const [k1, k2, k3, k4] = S.k;

  // ---- the controls ----
  const P = 6.3 * Math.pow(1.45, k3);
  const A = k2 * P;
  const elev = (k4 * PI) / 180;
  // Light wanders around the classic upper-left: the azimuth is in screen space, y down.
  const az = -2.35 + 0.8 * sin(0.0311 * t + S.lp[0]) + 0.55 * sin(0.0173 * t + S.lp[1]) + 0.25 * sin(0.0507 * t + S.lp[2]);
  const lz = sin(elev), lxy = cos(elev);
  const lx = lxy * cos(az), ly = lxy * sin(az);
  const contrast = 1.15;

  // ---- colour ----
  const hInk = 0.098 + k1 + 0.016 * sin(0.0211 * t + S.hp[0]) + 0.008 * sin(0.0137 * t + S.hp[1]);
  hsv(hInk, 0.78, 0.72, S.c[0]);
  hsv(hInk + 0.012, 0.27, 0.96, S.c[1]);
  hsv(hInk + 0.45, 0.05, 1.0, S.c[2]);
  hsv(hInk + 0.52, 0.95, 1, S.g);
  const [c0, c1, c2] = S.c;

  // ---- sources ----
  // Higher relief means broader hills, not steeper ones: a lens of 3 pitches on a 10-LED knoll would fold the lines over.
  const ks = 0.55 + 0.45 * k2;
  const src = S.src;
  for (let i = 0; i < NSRC; i++) {
    const s = src[i];
    const e = sm(0, 14, s.age) * sm(0, 14, s.life - s.age);
    const o = i * 9;
    SC[o] = s.x;
    SC[o + 1] = s.y;
    SC[o + 2] = cos(s.ang);
    SC[o + 3] = sin(s.ang);
    SC[o + 4] = 1 / (s.su * ks * s.su * ks);
    SC[o + 5] = 1 / (s.sv * ks * s.sv * ks);
    // Each hill is held to the slope the lines can take: the height it is given saturates where its steepest flank
    // would lean past SLOPE, so a tall knoll is a wide-shouldered one and a high Height knob swells the broad hills.
    const su = s.su * ks, sv = s.sv * ks;
    const sl1 = s.kind === 2 ? 1.65 / su : 0.607 / min(su, sv);
    const x = (A * abs(s.amp) * sl1) / SLOPE;
    SC[o + 6] = s.amp * e / Math.pow(1 + x * x * x * x, 0.25);
    SC[o + 7] = s.kind;
  }

  // Slope guard. The lines may lean 40 degrees but must never fold back on themselves, so a coarse probe of the
  // field sets how much of A can be used; it falls at once and recovers over a few seconds, which keeps the
  // bending from popping when a hill crosses the panel.
  let np = 0;
  for (let gy = 0; gy < 40; gy++)
    for (let gx = 0; gx < 20; gx++) {
      field(gx * 3.4 + 1, gy * 3.3 + 1);
      const sl = A * sqrt(FX * FX + FY * FY);
      // Where the displacement rises up the panel the lines spread, to at most 1.7 pitches apart; where it falls they
      // close in, to 0.55. The steepest 4% of the panel may exceed this: the distance estimate below copes with a fold.
      PROBE[np++] = max(sl / 1.0, (-A * FY) / 0.42, (A * FY) / 0.8);
    }
  PROBE.sort();
  const worst = max(0.001, PROBE[floor(np * 0.96)]);
  const want = min(1, 1 / worst);
  if (want < S.use) S.use += (want - S.use) * 0.5;
  else S.use += (want - S.use) * 0.01;
  const Ae = A * S.use;

  const nz = S.nz;
  const NZ = nz.length;
  const nzAt = (u) => {
    const f = u - floor(u), i = floor(u);
    const a = nz[((i % NZ) + NZ) % NZ], b = nz[(((i + 1) % NZ) + NZ) % NZ];
    const w = f * f * (3 - 2 * f);
    return a + (b - a) * w;
  };

  const out = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      field(x, y);
      const h = FH, hx = FX, hy = FY;

      // The lines are the level sets of f = y + A h: a raised point pushes its line up the panel.
      const f = y + Ae * h;
      const fx = Ae * hx, fy = 1 + Ae * hy;
      const gm = max(0.32, sqrt(fx * fx + fy * fy));
      const m = (f - 3) / P;
      const n = Math.round(m);
      const d = abs(f - 3 - n * P) / gm;
      const gap = P / gm;

      // Light on the surface z = A h.
      const zx = fx, zy = Ae * hy;
      const L = (-zx * lx - zy * ly + lz) / sqrt(1 + zx * zx + zy * zy) - lz;
      const tone = cl(0.5 + contrast * L, 0, 1);

      // Width by tone, then by what the neighbours leave.
      let w = 0.5 + 4.5 * Math.pow(tone, 1.2);
      w *= 1 + 0.3 * nzAt(x / 7 + n * 5.3 + t * 0.05);
      w = min(w, 5, gap - 1.6);
      let alpha = 1;
      if (w < 1.4) {
        alpha = sm(0.5, 1.4, w);
        w = 1.4;
      }
      // exact overlap of the pixel with the strip
      const lo = max(d - 0.5, -w / 2), hi = min(d + 0.5, w / 2);
      const cov = max(0, hi - lo) * alpha;

      // ink colour by tone: warm in the shadows, cool in the light
      let r, g, b;
      if (tone < 0.5) {
        const u = tone * 2;
        r = c0[0] + (c1[0] - c0[0]) * u; g = c0[1] + (c1[1] - c0[1]) * u; b = c0[2] + (c1[2] - c0[2]) * u;
      } else {
        const u = (tone - 0.5) * 2;
        r = c1[0] + (c2[0] - c1[0]) * u; g = c1[1] + (c2[1] - c1[1]) * u; b = c1[2] + (c2[2] - c1[2]) * u;
      }
      const gv0 = 0.15 + 0.07 * tone;
      out[0] = 255 * (S.g[0] * gv0 * (1 - cov) + r * cov);
      out[1] = 255 * (S.g[1] * gv0 * (1 - cov) + g * cov);
      out[2] = 255 * (S.g[2] * gv0 * (1 - cov) + b * cov);
      display.setPixel(x, y, out[0], out[1], out[2]);
    }
  }
}
