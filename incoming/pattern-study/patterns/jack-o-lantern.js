// ===== Patternflow pattern =====
// Title:   Jack-o'-Lantern
// Family:  halloween
// Idea:    A carved pumpkin sits at the foot of the panel lit by a candle inside, its eyes, nose and grin pulsing from deep orange to white-hot as the flame flickers, and from every opening a shaft of light climbs the panel and swings with the flame, a violet haze in clear air that turns orange where it crosses the drifting purple fog banks.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 41; after the carved turnip and pumpkin lanterns of Halloween
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Fire=0..1, Speed=0.2..3, Face=0..3, Fog=-1..1
//
// Knob 1: Fire. The colour of the candle, and so of the carving and the shafts. At 0 an orange flame in purple mist; at 0.33 toxic green in purple; at 0.67 violet in green mist; at 1 a blue flame in purple. The pumpkin itself stays orange.
// Knob 2: Speed. Runs the flame, its sway and the mist together. At 2 the flame pulses on beats of 1.4, 3.4 and 7.2 a second under a wandering dip, the candle sways up to 3 LEDs either way and swings the eye shafts about 5 degrees, and the fog banks sink 1.6 LEDs a second while their ripples drift left at about 6; at 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Face. Four carvings. 0: triangle eyes and nose and a grin with three teeth. 1: slanted angry eyes and a jagged mouth whose teeth interlock. 2: round eyes with the pupils left standing, so each eye's shaft carries a dark core up the panel, and an open O. 3: crescent eyes and a grin crossed by stitches, each gap throwing its own thin shaft down to the ground fog.
// Knob 4: Fog. At -1 the air is clear and the shafts show only as violet haze, about 108 to 126 LEDs long. At 0.06, the opening, fog banks about 20 rows apart drift across, turning orange where a shaft crosses them, and the shafts reach about 81 to 94 LEDs, their ends ragged with the mist. At 1 the fog fills most of the panel and the shafts reach about 57 to 66.
// Buttons: K1 tap snuffs the candle: for 0.8 seconds it gutters and the shafts draw back into the pumpkin, then it is out for 1.2 seconds with the carving an ember red, then it flares white and burns again by 2.5 seconds.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, hypot, sqrt, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function hash(i, j) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// The pumpkin, centred at PX, PY: five lobes, [x offset, half-width,
// half-height], the front one first so it shades the LEDs it holds.
const PX = 32, PY = 100;
const LOBES = [
  [0, 13, 22],
  [-10, 13, 21],
  [10, 13, 21],
  [-18, 10, 18],
  [18, 10, 18],
];
// The candle, from the pumpkin's centre: between the nose and the grin.
const CX = 0, CY = 4.5;

function inTri(px, py, t) {
  const [[ax, ay], [bx, by], [cx, cy]] = t;
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const tri = (x) => abs(x - 6 * floor(x / 6) - 3);

// The four carvings, in pumpkin coordinates (x right, y down from the
// centre): 1 where the knife went through.
const FACES = [
  // Triangle eyes, triangle nose, a grin with two teeth above and one below.
  (x, y) => {
    if (inTri(x, y, [[-17, -4], [-5, -4], [-11, -15]]) || inTri(x, y, [[17, -4], [5, -4], [11, -15]])) return 1;
    if (inTri(x, y, [[-3.5, 3], [3.5, 3], [0, -3]])) return 1;
    const u = x / 20;
    if (abs(u) >= 1) return 0;
    const top = 6 + 4 * (1 - u * u), bot = 6 + 12 * (1 - u * u);
    if (y <= top || y >= bot) return 0;
    if (((x > -10 && x < -5) || (x > 5 && x < 10)) && y < top + 4) return 0;
    return x > -2.5 && x < 2.5 && y > bot - 4 ? 0 : 1;
  },
  // Slanted angry eyes and a jagged mouth whose teeth interlock.
  (x, y) => {
    if (inTri(x, y, [[-18, -13], [-4, -6], [-13, -2]]) || inTri(x, y, [[18, -13], [4, -6], [13, -2]])) return 1;
    if (inTri(x, y, [[-3, 3], [3, 3], [0, -2]])) return 1;
    if (abs(x) > 19) return 0;
    const bend = 0.012 * x * x;
    return y > 7 + tri(x + 19) - bend && y < 16 - tri(x + 22) - bend ? 1 : 0;
  },
  // Round eyes with the pupils left standing, and an open O.
  (x, y) => {
    for (const s of [-1, 1]) {
      const d = hypot(x - s * 10, y + 7);
      if (d < 6) return d > 2.4 ? 1 : 0;
    }
    if (inTri(x, y, [[-2.5, 3], [2.5, 3], [0, -1]])) return 1;
    return hypot(x / 7.5, (y - 11) / 6.5) < 1 ? 1 : 0;
  },
  // Crescent eyes and a wide grin crossed by stitches.
  (x, y) => {
    for (const s of [-1, 1]) {
      const ex = x - s * 10, ey = y + 6;
      if (hypot(ex, ey) < 6.5 && hypot(ex, ey + 4) > 6) return 1;
    }
    const u = x / 22;
    if (abs(u) >= 1) return 0;
    const top = 3 + 8 * (1 - u * u), bot = top + 5 + 2 * (1 - u * u);
    return y > top && y < bot && abs(x + 30 - 5 * floor((x + 30) / 5) - 2.5) < 1.4 ? 1 : 0;
  },
];

// Fire colours along K1: flame, white-hot core, mist.
const FIRES = [
  [[1, 0.48, 0.03], [1, 0.93, 0.55], [0.42, 0.1, 0.66]],
  [[0.42, 1, 0.06], [0.88, 1, 0.6], [0.42, 0.1, 0.66]],
  [[0.68, 0.2, 1], [0.96, 0.82, 1], [0.08, 0.5, 0.2]],
  [[0.2, 0.55, 1], [0.82, 0.96, 1], [0.4, 0.1, 0.62]],
];

export function setup(params) {
  const body = new Float32Array(N), holes = FACES.map(() => new Uint8Array(N)), stem = new Uint8Array(N);
  // The stem: a thick green curve leaning right from the top of the pumpkin.
  const curve = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    curve.push([mix(mix(-1, -1.5, t), mix(-1.5, 5, t), t), mix(mix(-19, -26, t), mix(-26, -29, t), t), 2.4 - 0.8 * t]);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - PX, py = y + 0.5 - PY, p = y * W + x;
      for (const [lx, rx, ry] of LOBES) {
        const rho = hypot((px - lx) / rx, py / ry);
        if (rho < 1) {
          body[p] = sqrt(1 - rho * rho);
          break;
        }
      }
      if (body[p] > 0) FACES.forEach((f, i) => (holes[i][p] = f(px, py)));
      else for (const [sx, sy, sr] of curve) if (hypot(px - sx, py - sy) < sr) stem[p] = 1;
    }
  // Each hole LED's distance to the flesh, for the glowing cut rim.
  const edges = holes.map((h) => {
    const e = new Float32Array(N);
    for (let p = 0; p < N; p++) {
      if (!h[p]) continue;
      const x = p % W, y = floor(p / W);
      let best = 9;
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) if (!h[(y + j) * W + x + i]) best = min(best, hypot(i, j));
      e[p] = best;
    }
    return e;
  });
  // The openings of each carving, by flood fill. Slivers at the tapering
  // ends of a grin, under 10 LEDs, throw no shaft of their own.
  const openings = holes.map((h) => {
    const seen = new Uint8Array(N), out = [];
    for (let p0 = 0; p0 < N; p0++) {
      if (!h[p0] || seen[p0]) continue;
      const px = [], stack = [p0];
      seen[p0] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % W;
        px.push(p);
        for (const q of [x < W - 1 ? p + 1 : -1, x > 0 ? p - 1 : -1, p + W, p - W]) if (q >= 0 && q < N && h[q] && !seen[q]) (seen[q] = 1), stack.push(q);
      }
      if (px.length < 10) continue;
      let sx = 0, sy = 0;
      for (const p of px) (sx += (p % W) + 0.5), (sy += floor(p / W) + 0.5);
      out.push({ px, x: sx / px.length, y: sy / px.length, ux: 0, uy: 1, mask: new Uint8Array(NB), end: new Float32Array(NB) });
    }
    return out;
  });
  params.s = {
    fire: 0, speed: 2, face: 0, fog: 0.06, t: 0, pulse: 0.5, sway: 0, bob: 0, light: 1, gut: -1,
    body, holes, edges, openings, stem, grid: new Float32Array(17 * 33), pal: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
}

// The candle out, then back: seconds from the tap.
const DIE = 0.8, DARK = 2, LIGHT = 2.5;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.fire = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.face = round(cl(k[2], 0, 3));
  S.fog = cl(k[3], -1, 1);
  S.t += d * S.speed;
  // The flame: a slow breath, a quick shiver and a wandering dip, 0..1.
  const t = S.t * 2.5;
  S.pulse = cl(0.55 + 0.2 * sin(t * 1.7) + 0.12 * sin(t * 4.3 + 1) + 0.1 * sin(t * 9.1 + 2) + 0.7 * (vnoise(t * 2.6, 3.7) - 0.5), 0, 1);
  S.sway = 3 * (vnoise(S.t * 1.1, 9.1) - 0.5) * 2;
  S.bob = vnoise(S.t * 2.3, 1.3) - 0.5;
  if (input.btnPressed && input.btnPressed[0] && S.gut < 0) S.gut = 0;
  if (S.gut >= 0) {
    S.gut += d;
    const g = S.gut;
    // Gutters: shrinking with big shudders; out; then a flare and back.
    if (g < DIE) S.light = (1 - g / DIE) * (0.6 + 0.4 * vnoise(g * 14, 2.2));
    else if (g < DARK) S.light = 0;
    else if (g < LIGHT) S.light = 1.25 * sm(DARK, DARK + 0.12, g) - 0.25 * sm(DARK + 0.12, LIGHT, g);
    else (S.light = 1), (S.gut = -1);
  }
}

// Each opening throws its own shaft: the opening pushed outward along the
// line from the candle through its middle, that line squeezed sideways to
// 0.42 so the shafts climb the tall panel instead of leaving by its sides,
// and widening by 0.6% a LED. The profile across a shaft is the opening's
// own, teeth and pupils and all.
const SQUEEZE = 0.42, SPREAD = 0.006, BIN = 2, NB = 120;
function aim(S, cx, cy) {
  const list = S.openings[S.face];
  for (const c of list) {
    let ux = (c.x - cx) * SQUEEZE, uy = c.y - cy;
    const l = hypot(ux, uy) || 1;
    (ux /= l), (uy /= l), (c.ux = ux), (c.uy = uy);
    c.mask.fill(0);
    c.end.fill(-1e9);
    for (const p of c.px) {
      const dx = (p % W) + 0.5 - c.x, dy = floor(p / W) + 0.5 - c.y, sv = dx * ux + dy * uy, vv = dy * ux - dx * uy;
      for (let b = floor((vv - 0.5) * BIN + NB / 2); b <= floor((vv + 0.5) * BIN + NB / 2); b++) {
        if (b < 0 || b >= NB) continue;
        c.mask[b] = 1;
        c.end[b] = max(c.end[b], sv);
      }
    }
  }
  return list;
}

function palette(S) {
  const u = S.fire * 3, i = min(2, floor(u)), t = u - i;
  for (let c = 0; c < 3; c++) for (let ch = 0; ch < 3; ch++) S.pal[c][ch] = mix(FIRES[i][c][ch], FIRES[i + 1][c][ch], t);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const { body, stem, grid: G } = S, hole = S.holes[S.face], edge = S.edges[S.face];
  const [flame, hot, mist] = S.pal, P = S.pulse, L = S.light;
  const list = aim(S, PX + CX + S.sway, PY + CY + S.bob);
  // Fog: how much of the dark the mist takes, and how far the shafts reach,
  // which breathes with the flame and shrinks to nothing as it gutters.
  const fogD = 0.37 + 0.3 * S.fog, reach = (96 - 30 * S.fog) * (0.86 + 0.14 * P) * min(1, L);
  // The mist, on a grid 4 LEDs a cell read back bilinearly: banks every 20
  // rows, sinking slowly and rippled by a noise drifting left, broken by a
  // finer noise drifting right and up, thicker on the ground where the
  // grin's shaft lands, and cut at two levels.
  const mt = S.t;
  for (let j = 0; j < 33; j++)
    for (let i = 0; i < 17; i++)
      G[j * 17 + i] = 0.5 + 0.28 * sin(TAU * (j / 5 - mt * 0.04) + 3 * (vnoise(i / 8 + mt * 0.09, j / 4) - 0.5)) + 0.3 * (vnoise(i / 4 - mt * 0.16, j / 1.5 + 0.3 * mt) - 0.5) + 0.2 * sm(28, 32, j);
  // The openings: white-hot inside, flame-coloured at the cut rim; as the
  // candle dies they sink to an ember red.
  const ember = [0.45, 0.04, 0.02], lit = min(1, L), flare = max(0, L - 1) * 4;
  const holeCol = (rim, ch) => mix(ember[ch], mix(rim ? flame[ch] : mix(flame[ch], hot[ch], 0.45 + 0.55 * P), 1, flare) * (0.82 + 0.18 * P), lit);
  const inner = [holeCol(false, 0), holeCol(false, 1), holeCol(false, 2)], rim = [holeCol(true, 0), holeCol(true, 1), holeCol(true, 2)];
  // Lit mist: the flame colour a little toward white-hot when the flame peaks.
  const beam = [0, 1, 2].map((ch) => mix(flame[ch], hot[ch], 0.3 * P) * (0.84 + 0.16 * P));
  const glow = mix(0.45, 0.74 + 0.26 * P, lit);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = 0, g = 0, b = 0;
      if (body[p] > 0) {
        if (hole[p]) {
          const c = edge[p] < 1.6 ? rim : inner;
          (r = c[0]), (g = c[1]), (b = c[2]);
        } else {
          // Two tones a lobe and a dark seam between lobes, warmed by the candle.
          const v = (body[p] > 0.6 ? 0.74 : body[p] > 0.4 ? 0.52 : 0) * glow;
          (r = v), (g = 0.36 * v * v), (b = 0.02 * v);
        }
      } else if (stem[p]) {
        (r = 0.32), (g = 0.86), (b = 0.12);
      } else {
        const gx = x / 4, gy = y / 4, i = floor(gx), j = floor(gy), u = gx - i, v = gy - j, q = j * 17 + i;
        const n = (G[q] * (1 - u) + G[q + 1] * u) * (1 - v) + (G[q + 17] * (1 - u) + G[q + 18] * u) * v;
        const m = n > 1.12 - fogD ? 2 : n > 1 - fogD ? 1 : 0;
        // Inside a shaft? Its end is ragged with the mist.
        let inside = false;
        const far = reach * (0.75 + 0.5 * n);
        for (const c of list) {
          const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y, sv = dx * c.ux + dy * c.uy;
          if (sv <= 0) continue;
          const bn = floor(((dy * c.ux - dx * c.uy) / (1 + SPREAD * sv)) * BIN + NB / 2);
          if (bn >= 0 && bn < NB && c.mask[bn] && sv > c.end[bn] && sv < c.end[bn] + far) {
            inside = true;
            break;
          }
        }
        // Lit mist takes the flame's colour; a shaft through clear air shows
        // as a faint violet haze between the banks.
        if (inside && m) {
          const lv = m === 2 ? 1 : 0.8;
          (r = beam[0] * lv), (g = beam[1] * lv), (b = beam[2] * lv);
        } else if (inside) {
          (r = mist[0] * 0.3 + beam[0] * 0.12), (g = mist[1] * 0.3 + beam[1] * 0.12), (b = mist[2] * 0.3 + beam[2] * 0.12);
        } else if (m) {
          const lv = m === 2 ? 0.44 : 0.26;
          (r = mist[0] * lv), (g = mist[1] * lv), (b = mist[2] * lv);
        }
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}
