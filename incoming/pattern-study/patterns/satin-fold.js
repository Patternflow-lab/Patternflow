// ===== Patternflow pattern =====
// Title:   Satin Fold
// Family:  cosmetic
// Idea:    A pale sheet of satin hangs in folds from a point above the panel and sways under a light from the left; its fibres run across the folds, so the sheen lies in long streaks along them, and one thin gold line crosses the cloth and bends over every fold it meets.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 30, after satin weave sheen and gold-foil packaging; the sheen is a fibre highlight (James Kajiya and Timothy Kay, 1989) with an anisotropic lobe (Gregory Ward, 1992)
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Folds=1..5, Gold=0..1
//
// Knob 1: Hue. The dye of the satin, once round the wheel, while the gold line stays gold. At 0 blush rose, at 0.1 nude champagne, at 0.25 pistachio, at 0.45 mint, at 0.6 powder blue and at 0.8 lilac.
// Knob 2: Speed. How fast the folds sway. At 2 they cross the middle of the panel at about 6 LEDs a second and the glints run 26 LEDs a second along the gold line; at 0.2 the folds go a tenth as fast and the glints half.
// Knob 3: Folds. One fold family more at each whole step, fading in over the step before. At 1 only the fan hanging from a point 160 LEDs above the panel's middle, 22 folds to the radian; 2 adds a diagonal drape 46 LEDs across, 3 and 4 two narrower ones at other angles, and 5 a pressed fold with sharp creases. The cloth also gets deeper, from 0.75 of the folds' base height at 1 to 1.47 at 5.
// Knob 4: Gold. The gold line. At 0 there is none, at 0.06 a thread about 2 LEDs wide with a glint every 54 LEDs, at 1 a ribbon 13 LEDs wide with a glint every 29. It shades the cloth on its right, 1 LED wide at the thread and 3.5 at the ribbon.
// Buttons: K1 tap sends a gust under the cloth: a bowed swell 5.5 LEDs high runs up the sheet from below the bottom edge to past the top in 2.5 seconds.

const W = 64, H = 128;
const { sin, cos, sqrt, exp, floor, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The first fold family is a fan: the cloth is held at a point 160 LEDs
// above the panel's middle and a little left, and 22 folds a radian hang from
// it, tight at the top of the panel and wide at the bottom.
const PX = -14, PY = -160, FAN = 22, FAN_A = 6.5, RC = 160;
// The others are straight waves: crest angle in degrees, wavelength in LEDs,
// height in LEDs, bend of the crest, travel in radians a second at Speed 1,
// swell phase. The last is pressed: its profile has sharp valleys. The first
// row stands for the fan, which reads only its travel and phase from it.
const FOLDS = [
  [0, 1, 0, 0, 0.42, 0.0],
  [58, 46, 4.2, -0.004, -0.33, 2.1],
  [100, 30, 2.6, 0.007, 0.55, 4.0],
  [128, 24, 1.8, -0.008, -0.71, 1.2],
  [76, 28, 1.4, 0.004, 0.62, 3.3],
].map(([ang, lam, A, c, w, ph]) => {
  const a = (ang * PI) / 180;
  return { tx: cos(a), ty: sin(a), nx: -sin(a), ny: cos(a), k: (2 * PI) / lam, A, c, w, ph };
});

// Light from the left, a little above and in front; the eye straight on.
// y runs down.
const norm3 = (x, y, z) => {
  const l = sqrt(x * x + y * y + z * z);
  return [x / l, y / l, z / l];
};
const [LX, LY, LZ] = norm3(-0.6, -0.35, 0.72);
const [HX, HY, HZ] = norm3(LX, LY, LZ + 1);
// The floats of the satin weave run nearly across the panel, rising a little
// to the right, so they cross the hanging folds and catch the light only
// where they tilt square to the half vector.
const FX = 0.985, FY = -0.17;
// The gold line in the cloth's own coordinates: through the middle, going
// down to the right, bowed a little.
const [GX, GY] = (() => {
  const l = Math.hypot(0.42, 1);
  return [0.42 / l, 1 / l];
})();
const MX = -GY, MY = GX;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// The satin's ramp from the deepest hollow (0) to the brightest sheen (1):
// the hue deep and saturated in the hollows, pale over the body, near white
// in the streaks.
const RAMP = 256;
function ramp(P) {
  const hue = P.hue + 0.975;
  for (let i = 0; i < RAMP; i++) {
    const s = i / (RAMP - 1);
    let sat, val;
    if (s < 0.5) {
      const u = s / 0.5;
      sat = 0.46 + (0.18 - 0.46) * u;
      val = 0.5 + (0.8 - 0.5) * u;
    } else {
      const u = (s - 0.5) / 0.5;
      sat = 0.18 + (0.04 - 0.18) * u;
      val = 0.8 + (0.97 - 0.8) * u;
    }
    hsv(hue - 0.015 * (1 - s), sat, val, P.lut, i * 3);
  }
  P.lutHue = P.hue;
}

export function setup(params) {
  params.s = {
    t: 0, clock: 0, hue: 0, speed: 2, folds: 1, gold: 0.06, gust: -1,
    lut: new Float32Array(RAMP * 3), lutHue: NaN, cw: new Float32Array(W), cd: new Float32Array(W),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.folds = cl(k[2], 1, 5);
  P.gold = cl(k[3], 0, 1);
  P.t += d * P.speed;
  P.clock += d;
  if (P.gust >= 0) {
    P.gust += d / 2.5;
    if (P.gust >= 1) P.gust = -1;
  } else if (input.btnPressed && input.btnPressed[0]) P.gust = 0;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  if (P.lutHue !== P.hue) ramp(P);
  const T = P.t, F = P.folds, lut = P.lut;
  // Each family fades in over one step of Folds, and the whole cloth gets
  // deeper as it does.
  const depth = 0.75 + 0.18 * (F - 1);
  const act = [];
  for (let i = 0; i < FOLDS.length; i++) {
    const f = FOLDS[i], wgt = sm(0, 1, F - i);
    if (wgt <= 0) continue;
    const swell = 0.72 + 0.28 * sin(0.37 * T + f.ph);
    act.push({ ...f, A: (i ? f.A * swell : FAN_A) * wgt * depth, phase: f.w * T + f.ph, press: i === 4 });
  }
  const na = act.length, fan = act[0];
  let tot = 0;
  for (const f of act) tot += f.A;
  // The gust: one ridge across the sheet that runs from the bottom up.
  let gA = 0, gy0 = 0;
  if (P.gust >= 0) {
    gA = 5.5 * sin(PI * P.gust);
    gy0 = 80 - 190 * P.gust;
  }
  const wa = 3.2;
  // The panel sees the cloth a little from below, so a line on it shifts
  // with the height of the cloth under it: 0.65 LED a LED of height at one
  // fold family, less on the deep drapes.
  const lean = 0.65 / (1 + 0.15 * (F - 1));
  const g = P.gold, gAlpha = sm(0, 0.04, g), hw = 0.6 + 6 * g, sw = 1 + 2.5 * g;
  const gf = 0.11 + 0.11 * g, gT = P.clock * (0.6 + 0.4 * P.speed);
  // The warp's sideways part, one value a column.
  const CW = P.cw, CD = P.cd;
  for (let x = 0; x < W; x++) {
    const u = (x - 31.5) * 0.07 - T * 0.17 + 1.3;
    CW[x] = wa * sin(u);
    CD[x] = wa * 0.07 * cos(u);
  }
  for (let y = 0; y < H; y++) {
    const py = y - 63.5;
    const s1 = sin(py * 0.045 + T * 0.23), c1 = cos(py * 0.045 + T * 0.23);
    const dxdy = wa * 0.045 * c1;
    for (let x = 0; x < W; x++) {
      const px = x - 31.5;
      const dydx = CD[x];
      const qx = px + wa * s1, qy = py + CW[x];
      let h = 0, gx = 0, gy = 0;
      {
        // The fan: the fold phase goes with the angle round the point it
        // hangs from, and leans with the distance. Its height grows as the
        // square root of the distance, and a swell runs down it.
        const dx = qx - PX, dy = qy - PY, r2 = dx * dx + dy * dy, r = sqrt(r2);
        const th = FAN * Math.atan2(dx, dy) + 0.025 * r - fan.phase;
        const sv = 0.045 * r - 0.5 * T, ms = 0.75 + 0.25 * sin(sv), rr = sqrt(r / RC);
        const A = fan.A * rr * ms, dA = A / (2 * r) + fan.A * rr * 0.01125 * cos(sv);
        const sn = sin(th), cs = cos(th);
        h += A * sn;
        const gr = dA * sn + A * cs * 0.025, ga = (A * cs * FAN) / r2;
        gx += (gr * dx) / r + ga * dy;
        gy += (gr * dy) / r - ga * dx;
      }
      for (let j = 1; j < na; j++) {
        const f = act[j];
        const a = qx * f.tx + qy * f.ty, s = qx * f.nx + qy * f.ny + f.c * a * a;
        const th = f.k * s - f.phase;
        let v, dv;
        if (f.press) {
          // sqrt(sin^2 + e^2): round crests, sharp valleys.
          const sn = sin(th), cs = cos(th), r = sqrt(sn * sn + 0.04);
          v = f.A * (r - 0.6);
          dv = (f.A * f.k * sn * cs) / r;
        } else {
          v = f.A * sin(th);
          dv = f.A * f.k * cos(th);
        }
        h += v;
        const ex = f.nx + 2 * f.c * a * f.tx, ey = f.ny + 2 * f.c * a * f.ty;
        gx += dv * ex;
        gy += dv * ey;
      }
      if (gA > 0) {
        const e = (qy - gy0 - 0.006 * qx * qx) / 12, b = gA * exp(-e * e), d = (-2 * e * b) / 12;
        h += b;
        gx += d * -0.012 * qx;
        gy += d;
      }
      // Back from the cloth's coordinates to the panel's.
      const hx = gx + gy * dydx, hy = gx * dxdy + gy;
      // Normal and the fibre's tangent on the surface.
      const nl = 1 / sqrt(hx * hx + hy * hy + 1), Nx = -hx * nl, Ny = -hy * nl, Nz = nl;
      let Tx = FX, Ty = FY, Tz = FX * hx + FY * hy;
      const tl = 1 / sqrt(Tx * Tx + Ty * Ty + Tz * Tz);
      (Tx *= tl), (Ty *= tl), (Tz *= tl);
      const NL = Nx * LX + Ny * LY + Nz * LZ;
      const dif = cl((NL + 0.45) / 1.45, 0, 1);
      // Ward-like lobe: narrow along the fibre, broad across it.
      const TH = Tx * HX + Ty * HY + Tz * HZ;
      const Bx = Ny * Tz - Nz * Ty, By = Nz * Tx - Nx * Tz, Bz = Nx * Ty - Ny * Tx;
      const BH = Bx * HX + By * HY + Bz * HZ;
      const spec = 0.45 * exp(-(TH * TH) / 0.012 - (BH * BH) / 0.35) + 0.5 * exp(-(TH * TH) / 0.06 - (BH * BH) / 0.6);
      // The hollows get less of the light, and less of the sheen.
      const ao = sm(-0.9 * tot, 0.6 * tot, h);
      const shade = cl(0.05 + 0.7 * dif * (0.4 + 0.6 * ao) + 0.5 * spec * (0.25 + 0.75 * ao), 0, 1);
      const o = ((shade * (RAMP - 1)) | 0) * 3;
      let r = lut[o], gg = lut[o + 1], b = lut[o + 2];
      if (gAlpha > 0) {
        const al = qx * GX + qy * GY;
        const vv = qx * MX + qy * MY + 0.0018 * al * al - 4 + lean * h;
        const ggx = MX + 0.0036 * al * GX, ggy = MY + 0.0036 * al * GY;
        const vx = ggx + ggy * dydx + lean * hx, vy = ggx * dxdy + ggy + lean * hy;
        // Where a fold turns the line back on itself it passes behind the
        // fold, so it fades out there instead of spreading into a blot.
        const gl = sqrt(vx * vx + vy * vy), sd = vv / Math.max(0.3, gl), dist = Math.abs(sd), seen = gAlpha * sm(0.3, 0.7, gl);
        // The line stands a little off the cloth and shades it on the side
        // away from the light.
        if (sd < 0) {
          const sh = 1 - 0.3 * seen * sm(hw + 0.5 + sw, hw - 0.5, dist);
          (r *= sh), (gg *= sh), (b *= sh);
        }
        const cov = cl(hw + 0.5 - dist, 0, 1) * seen;
        if (cov > 0) {
          const NH = Nx * HX + Ny * HY + Nz * HZ;
          const gs = NH > 0.95 ? ((NH - 0.95) / 0.05) ** 4 : 0;
          const tw = 0.5 + 0.5 * sin(al * gf - gT * 2.2);
          const glint = tw ** 24 + gs;
          const lit = 0.62 + 0.38 * dif, gw = cl(glint, 0, 1);
          const gr = 252 * lit + (255 - 252 * lit) * gw, ggr = 184 * lit + (246 - 184 * lit) * gw, gb = 58 * lit + (205 - 58 * lit) * gw;
          r += (gr - r) * cov;
          gg += (ggr - gg) * cov;
          b += (gb - b) * cov;
        }
      }
      display.setPixel(x, y, r, gg, b);
    }
  }
}
