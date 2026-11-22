// ===== Patternflow pattern =====
// Title:   Magic Angle
// Family:  moirelattice
// Idea:    Two honeycomb sheets lie one on the other and one is turned by a few degrees, so a triangular superlattice of warm AA spots joined by cool AB and BA triangles swells out of a fine moire, balloons, and shrinks again as the twist drifts.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Twisted bilayer graphene: the moire period a / (2 sin(theta / 2)) and the magic angle of about 1.1 degrees, Bistritzer and MacDonald (2011); superconductivity at that angle, Cao et al. (2018)
// Round:   218
// ===============================
// @matrix 64x128
// @knobs Hue=-0.12..0.38, Twist=0.8..5.5, Drift=0.3..2.3, Relax=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the AB and BA triangles, the walls and the dark base. At the opening 0 the AB triangles are teal (19, 158, 158), the BA triangles blue-violet (39, 30, 148), the base between them deep indigo (5, 18, 51), the AA spots pale amber (255, 181, 128) and the walls pale cyan (173, 240, 255); the offset is built in, so 0 is not red. At -0.12 the AB triangles are green and the BA steel blue, at 0.38 magenta and orange. The AA spots turn only 0.15 of the knob, so they stay a warm cream, and warm hues are lifted in brightness since a dark orange turns brown.
// Knob 2: Twist. The centre of the twist angle, 2.6 degrees per unit: 0.8 is 2.1 degrees and a cell 88 LEDs wide, 2 (the opening) is 5.2 degrees and a cell 35 LEDs wide, 5.5 is 14.3 degrees and a cell 13 LEDs wide. The drift swings the cell size around this centre.
// Knob 3: Drift. How far and how fast the twist wanders. At 0.3 the cell swings between 0.66 and 1.5 times its centre size (23 to 53 LEDs at the opening Twist) on swells of 63, 105 and 176 s; at 2.3 it swings between 0.38 and 2.6 times (13 to 92 LEDs at Twist 2) on swells of 41, 69 and 115 s. The rotation of the sheet and the wandering of the centre do not depend on it.
// Knob 4: Relax. The reconstruction of the lattice, -1 rigid and 1 fully relaxed, with a curve that puts the opening 0.06 at 0.43 of the way. Rigid, the registry is a soft gradient and the AA spots are broad blobs about 0.6 cells across. Relaxed, the AA spots shrink to discs 0.25 cells across (never under 4.6 LEDs), the AB and BA triangles fill with flat colour, and the domain walls between them show as bright lines 2 LEDs wide.

// The panel is a window onto a bilayer sheet. Layer 1 is a honeycomb lattice with constant a = 3.2 LEDs (bond
// 1.85 LEDs), turned by psi - theta/2. Layer 2 is the same lattice turned by psi + theta/2. Both are rotated
// by the sheet angle psi about the middle of the panel.
// Only the registry between the layers is needed. In fractional coordinates of the lattice, the layer
// positions are f1(r) and f2(r), both linear in r, and the shift between layers is s = f1 - f2 mod 1. That is
// a linear map of r with the gain a / L, where L = a / (2 sin(theta / 2)) is the moire period. s = (0, 0) is AA
// stacking, (1/3, 1/3) is AB, (2/3, 2/3) is BA. With A = 2 pi s1 and B = 2 pi s2:
//   g = (cos A + cos B + cos (A + B)) / 3   is 1 at AA, -1/2 at AB and BA, -1/3 on a domain wall
//   h = sin A + sin B - sin (A + B)         is + at AB, - at BA, and zero on the three families of lines
//                                           s1, s2, s1 + s2 = integer, which are the domain walls
// The lines run from AA spot to AA spot and cut the plane into triangles, AB up and BA down, so the triangular
// superlattice and its honeycomb of walls come out of the same 4 trig calls a pixel.
// The AA spot sits at the centre of the twist c, which wanders over the panel on slow sines, so the whole
// superlattice slides while the atoms hardly move (moving c moves layer 2 by only a / L of the distance).
// Layer 2's phase is f1 - s, so the atoms of the two layers are drawn from f1 and s alone. Each layer's atoms
// are the first shell of a honeycomb: cos(X1 - pi/3) + cos(X2 - pi/3) - cos(X1 + X2 - 2 pi/3), bright on the
// atoms and the bonds and dark in the hexagon holes. The two layers are averaged, so the atoms show at full
// contrast in the AA spots, where they agree, and half of it in the triangles, where they are offset. The
// texture is only about 13 percent of the brightness: the structure is the picture.
// Relaxation is drawn in three parts. The size of the AA disc is a threshold on g. The triangles take flat
// colour once they are a width of wall away from the nearest wall, and that width goes from 0.3 L (a
// gradient) to 1.5 LEDs. The walls are a gaussian 1.25 LEDs wide in the distance to the nearest wall line,
// which in LEDs is 0.866 L times the distance in s, so a wall is the same width at every cell size.
// The twist theta follows L, and ln L is the centre ln Lc plus a swing: three slow sines with periods of
// 47, 79 and 132 s (at drift speed 1) summed with weights 0.62, 0.38, 0.26 and scaled to 1. Their phases
// are integrated, so turning Drift never jumps the picture. The sheet angle psi is four sines (8 to 390 s)
// and the centre c two sines per axis, 86 to 214 s, none sharing a period, so the picture does not repeat.
// Below L = 15 LEDs the structure fades into a slow haze that drifts between teal and indigo, with the atoms
// still faintly in it, and is gone by L = 6.5, since the walls cannot be drawn narrower than 2 LEDs. At the top
// of Twist with Drift up that is where the cell spends most of its time.
// The AA spot and its bloom are screened over the colour under them, since a mix of amber and indigo at half
// weight is brown. The triangles are 38 percent darker in their middle than at their corners, and less so
// the more the lattice relaxes.
// All the knobs are smoothed over 0.25 s and snap at the first update.

const W = 64, H = 128;
const TAU = Math.PI * 2;
const SQ3 = Math.sqrt(3);
const A_LAT = 3.2; // the lattice constant, LEDs
const DEG = Math.PI / 180;
const CX0 = 32, CY0 = 64; // the middle of the panel, the sheet turns about it
const { floor, sin, cos, exp, abs, min, max, log, asin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
// screen of two channels in 0..255
const scr = (a, b) => 255 - ((255 - a) * (255 - min(255, b))) / 255;

function hsv(h, s, v) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return (v - v * s * max(0, min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

export function setup(params) {
  params.s = {
    t: 0,
    ready: false,
    k: [0, 2, 0.3, 0.06], // smoothed knobs
    // phases of the twist swing, chosen so the opening sits a little below the centre and balloons first
    tw: [-0.9, 3.9, 0.3],
    // the palette, 0..255
    cAB: [0, 0, 0], cBA: [0, 0, 0], cAA: [0, 0, 0], cMid: [0, 0, 0], cBloom: [0, 0, 0], cWall: [0, 0, 0], cGlowA: [0, 0, 0], cGlowB: [0, 0, 0], cCore: [0, 0, 0],
    // the frame
    L: 35, theta: 0.09, ax: 0, ay: 0, rho: 0.5,
    f0x: 0, f0y: 0, fxx: 0, fxy: 0, fyx: 0, fyy: 0,
    s0x: 0, s0y: 0, sxx: 0, sxy: 0, syx: 0, syy: 0,
  };
}

export function update(dt, input, params) {
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0.3, 0.06];
  dt = cl(dt, 0, 0.25);
  const a = S.ready ? 1 - exp(-dt / 0.25) : 1;
  for (let i = 0; i < 4; i++) S.k[i] += (kn[i] - S.k[i]) * a;
  S.ready = true;
  S.t += dt;
  const t = S.t;
  const [k1, k2, k3, k4] = S.k;

  // How far and how fast the twist wanders.
  const u = cl((k3 - 0.3) / 2, 0, 1);
  const swing = 0.42 + 0.54 * u;
  const speed = 0.75 + 0.4 * u;
  S.tw[0] += dt * speed * TAU / 47.3;
  S.tw[1] += dt * speed * TAU / 79.1;
  S.tw[2] += dt * speed * TAU / 131.7;
  const w = (0.62 * sin(S.tw[0]) + 0.38 * sin(S.tw[1]) + 0.26 * sin(S.tw[2])) / 1.1;

  // The centre of the twist angle and the cell it makes.
  const thc = k2 * 2.6 * DEG;
  const Lc = A_LAT / (2 * sin(thc / 2));
  const L = exp(log(Lc) + swing * w);
  const theta = 2 * asin(min(0.999, A_LAT / (2 * L)));
  S.L = L;
  S.theta = theta;

  // The sheet turns about the middle of the panel, and the centre of the twist wanders.
  const psi =
    0.55 * sin(0.0412 * t + 1.1) + 0.4 * sin(0.0273 * t + 4.0) + 0.25 * sin(0.0161 * t + 0.3) + 0.03 * sin(0.77 * t + 2.0);
  const cx = CX0 - 4 + 17 * sin(0.0731 * t + 0.7) + 9 * sin(0.0449 * t + 2.9);
  const cy = CY0 - 8 + 30 * sin(0.0517 * t + 1.9) + 16 * sin(0.0293 * t + 0.4);

  // The fractional coordinates of a vector (vx, vy) in the lattice a1 = (a, 0), a2 = (a/2, a sqrt3 / 2).
  const fx = (vx, vy) => (vx - vy / SQ3) / A_LAT;
  const fy = (vx, vy) => (2 * vy) / (SQ3 * A_LAT);
  const al1 = psi - theta / 2, al2 = psi + theta / 2;
  const c1 = cos(al1), n1 = sin(al1), c2 = cos(al2), n2 = sin(al2);
  // layer 1: f1 = F(R(-al1) (r - p0)); its gradient is F of the columns of R(-al1)
  S.fxx = fx(c1, -n1); S.fxy = fy(c1, -n1);
  S.fyx = fx(n1, c1); S.fyy = fy(n1, c1);
  S.f0x = -(S.fxx * CX0 + S.fyx * CY0);
  S.f0y = -(S.fxy * CX0 + S.fyy * CY0);
  // registry: s = (F R(-al1) - F R(-al2)) (r - c)
  S.sxx = fx(c1 - c2, n2 - n1); S.sxy = fy(c1 - c2, n2 - n1);
  S.syx = fx(n1 - n2, c1 - c2); S.syy = fy(n1 - n2, c1 - c2);
  S.s0x = -(S.sxx * cx + S.syx * cy);
  S.s0y = -(S.sxy * cx + S.syy * cy);

  // The palette. The hue offsets put the opening on teal, blue-violet and pale amber, never on red.
  // Warm hues are lifted, since a dark orange turns brown on the panel.
  const hue = k1;
  S.rho = Math.pow(cl((k4 + 1) / 2, 0, 1), 1.35);
  const warm = (h) => {
    const t = h - 0.08;
    const d = t - floor(t + 0.5);
    return exp(-(d * d) / 0.0144);
  };
  const hAB = hue + 0.5, hBA = hue + 0.68;
  const lift = (h, v) => min(1, v * (1 + 0.5 * warm(h)));
  S.cAB = hsv(hAB, 0.88 - 0.12 * warm(hAB), lift(hAB, 0.62));
  S.cBA = hsv(hBA, 0.8 - 0.12 * warm(hBA), lift(hBA, 0.58));
  S.cMid = hsv(hue + 0.62, 0.9, 0.2);
  S.cAA = hsv(0.07 + 0.15 * hue, 0.5, 1);
  S.cBloom = hsv(0.07 + 0.15 * hue, 0.6, 1);
  S.cWall = hsv(hue + 0.53, 0.32, 1);
  S.cCore = hsv(0.1 + 0.15 * hue, 0.12, 1);
  // the glow the structure fades to: a slow drift between a teal and an indigo haze, with a trace of amber
  S.cGlowA = [0, 1, 2].map((i) => 0.62 * S.cAB[i] + 0.1 * S.cAA[i]);
  S.cGlowB = [0, 1, 2].map((i) => 0.66 * S.cBA[i] + 0.06 * S.cAA[i]);
}

export function draw(display, params) {
  const S = params.s;
  const L = S.L;
  const rho = S.rho;
  const cAB = S.cAB, cBA = S.cBA, cAA = S.cAA, cMid = S.cMid, cWall = S.cWall, cGlowA = S.cGlowA, cGlowB = S.cGlowB, cCore = S.cCore, cBloom = S.cBloom;

  // How well the panel resolves the cell.
  const q = sm(6.5, 15, L);
  // Relaxation: the AA disc, the width the triangles blend over, and how strong the walls are.
  const gLo = max(-0.3, min(mix(-0.15, 0.8, Math.pow(rho, 0.85)), 1 - (4 * Math.PI * Math.PI / 3) * (2.3 / L) * (2.3 / L)));
  // the rim of the disc is about 2.5 LEDs across once relaxed, wide when rigid
  const edge = cl(10 / L, 0.1, 0.5);
  const gSpan = mix(1 - gLo, min(1 - gLo, edge), Math.pow(rho, 0.4));
  const wDom = mix(0.3 * L, 1.5, Math.pow(rho, 0.7));
  // the walls are 2 LEDs wide at every size, so in a small cell they are eased back to keep the triangles
  const wallStr = (0.2 + 0.8 * rho) * (0.55 + 0.45 * sm(8, 26, L));
  const toLed = 0.866 * L;
  const inv3 = 1 / 3;
  const k0 = 1 / 2.598;
  const tex = 0.13 * (0.45 + 0.55 * q);
  const shade = 0.25 + 0.55 * rho; // 1 is flat colour in the triangles
  const P3 = Math.PI / 3, P23 = 2 * Math.PI / 3;

  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    let s1 = S.s0x + S.sxx * 0.5 + S.syx * py;
    let s2 = S.s0y + S.sxy * 0.5 + S.syy * py;
    let fa = S.f0x + S.fxx * 0.5 + S.fyx * py;
    let fb = S.f0y + S.fxy * 0.5 + S.fyy * py;
    for (let x = 0; x < W; x++) {
      const sA = TAU * s1, sB = TAU * s2;
      const ca = cos(sA), na = sin(sA), cb = cos(sB), nb = sin(sB);
      const cc = ca * cb - na * nb, nc = na * cb + ca * nb;
      const g = (ca + cb + cc) * inv3;
      const h = (na + nb - nc) * k0;

      // distance to the nearest domain wall, in LEDs
      const d1 = abs(s1 - floor(s1 + 0.5));
      const d2 = abs(s2 - floor(s2 + 0.5));
      const s3 = s1 + s2;
      const d3 = abs(s3 - floor(s3 + 0.5));
      const wl = min(d1, d2, d3) * toLed;

      // flat triangles, a soft mid colour on the walls, a little brighter toward the AA spots
      const tt = sm(0, wDom, wl);
      const dom = h > 0 ? cAB : cBA;
      const e = (g + 0.5) * (1 / 1.5);
      const lift = mix(0.62, 1, sm(0, 0.55, e)) * (1 - shade) + shade;
      let r = mix(cMid[0], dom[0] * lift, tt), gg = mix(cMid[1], dom[1] * lift, tt), b = mix(cMid[2], dom[2] * lift, tt);

      // the atoms, drawn from the two layers' phases at low contrast
      const p1 = TAU * fa, p2 = TAU * fb;
      const q1 = p1 - sA, q2 = p2 - sB;
      const D = cos(p1 - P3) + cos(p2 - P3) - cos(p1 + p2 - P23) + cos(q1 - P3) + cos(q2 - P3) - cos(q1 + q2 - P23);
      const tx = ((D + 6) / 9 - 0.667) * 3;
      const mod = 1 + tex * tx;
      r *= mod; gg *= mod; b *= mod;

      // the domain walls
      const wa = exp(-(wl * wl) / 1.5625) * wallStr;
      r = mix(r, cWall[0], wa); gg = mix(gg, cWall[1], wa); b = mix(b, cWall[2], wa);

      // the AA spot, with a faint warm bloom round it. Both are screened over what is there, since a mix of
      // amber and indigo at half weight is brown.
      const bl = sm(-0.35, 1, g);
      const bloom = bl * bl * 0.2 * (1 - sm(gLo, gLo + gSpan, g));
      r = scr(r, cBloom[0] * bloom); gg = scr(gg, cBloom[1] * bloom); b = scr(b, cBloom[2] * bloom);
      const aa = sm(gLo, gLo + gSpan, g);
      const aam = 1 + tex * 1.3 * tx;
      r = scr(r * (1 - aa), cAA[0] * aam * aa); gg = scr(gg * (1 - aa), cAA[1] * aam * aa); b = scr(b * (1 - aa), cAA[2] * aam * aa);
      const core = sm(0.9, 1, g) * 0.35;
      r = mix(r, cCore[0], core); gg = mix(gg, cCore[1], core); b = mix(b, cCore[2], core);

      // too fine to resolve: fade to the mean colour
      if (q < 1) {
        const m = 0.5 + 0.5 * sin(0.047 * x + 0.026 * y + 0.21 * S.t) * cos(0.019 * y - 0.033 * x - 0.13 * S.t + 1);
        const gr = mix(cGlowA[0], cGlowB[0], m) * mod, gq = mix(cGlowA[1], cGlowB[1], m) * mod, gb = mix(cGlowA[2], cGlowB[2], m) * mod;
        r = mix(gr, r, q); gg = mix(gq, gg, q); b = mix(gb, b, q);
      }
      display.setPixel(x, y, r, gg, b);
      s1 += S.sxx; s2 += S.sxy; fa += S.fxx; fb += S.fxy;
    }
  }
}
