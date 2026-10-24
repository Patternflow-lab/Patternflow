// ===== Patternflow pattern =====
// Title:   Embossed Glow
// Family:  cosmetic
// Idea:    The whole panel is the face of a pressed shimmer highlighter embossed with one relief at a time, ripples, quilted diamonds, chevrons or scales, under a small lamp that wanders over it: the slopes catch the lamp as soft bands, shimmer grains glint where their facets meet the lamp and the eye so the glints run along the ridges, and every few seconds an unseen fingertip swipes a smooth satin trough through the emboss and wipes its glints away, until the pan is pressed again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 37, after embossed baked highlighters and pressed powder compacts
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Relief=0..3, Lamp=-1..1
//
// Knob 1: Hue. The shade of the powder, once round the wheel, with a sheen a little warmer than the body and glints nearly white with a trace of it. At 0 pink pearl, at 0.1 rose, at 0.2 rose gold, at 0.3 champagne, at 0.45 mint, at 0.6 aqua, at 0.8 lavender. From rose to lime the body is laid paler and its shaded side leans to rose, so it never reads brown or olive.
// Knob 2: Speed. At 2 the lamp wanders over the whole panel at up to 13 LEDs a second, a fingertip swipes every 6.5 s and takes 0.7 s over its stroke, and after every fourth swipe the pan is pressed again. At 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Relief. The emboss, one at a time: ripples 9 LEDs apart round the middle at 0, quilted diamonds 16 wide and 24 tall at 1, chevrons stacked every 10 rows at 2, overlapping scales 14 wide at 3.
// Knob 4: Lamp. How the powder is lit. At -1 the lamp hangs 9 LEDs over it and rakes the whole pan: flanks facing it catch 1.7 times the light of the flat and the far flanks drop to a fifth of it. At 0.06 it hangs 32 LEDs up. Turned on to 1 it rises to 64 and a room light overhead comes up to 2.4 times its strength, so the whole pan glows evenly, the bands go soft and the troughs nearly vanish into the satin.
// Buttons: K1 tap presses the pan again now: a pressing edge runs down from the top in 2.4 s, the emboss springs back up behind it and every glint returns.

const W = 64, H = 128, N = W * H;
const { floor, sin, cos, sqrt, abs, min, max, pow, round, random, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fr = (v) => v - floor(v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The four reliefs as heights from 0 (the floor of a groove) to 1 (a crest),
// in LEDs from the top left. Each repeats every 9 to 24 LEDs, wide enough
// that a slope spans three or more LEDs and its band reads.
function relief(kind, x, y) {
  if (kind === 0) {
    // Ripples round the middle, 9 LEDs apart, crests a little sharper than
    // the troughs.
    const r = hypot(x - 31.5, y - 63.5), c = 0.5 + 0.5 * cos((2 * PI * r) / 9);
    return pow(c, 0.8) * sm(0, 4, r) + (1 - sm(0, 4, r)) * 0.8;
  }
  if (kind === 1) {
    // Quilted diamonds 16 wide and 24 tall: each a pillow, stitched down
    // along its edges.
    const u = x / 16 + y / 24, v = x / 16 - y / 24, fu = fr(u) - 0.5, fv = fr(v) - 0.5;
    return pow(cos(PI * fu) * cos(PI * fv), 0.55);
  }
  if (kind === 2) {
    // Chevrons 16 LEDs a V, stacked every 10 rows, with a sharp crest and a
    // long back slope like a pressed rib.
    const yv = y + 8 * abs(2 * fr(x / 16 + 0.5) - 1), t = fr(yv / 10);
    return t < 0.3 ? sm(0, 0.3, t) : 1 - sm(0.3, 1, t);
  }
  // Scales 14 wide in rows 9 apart, each row overlapping the one above,
  // every scale rising to a rounded lip at its lower edge.
  const j = floor(y / 9 + 0.5);
  let best = -1, hh = 0;
  for (let jj = j + 1; jj >= j - 1; jj--) {
    const off = jj & 1 ? 7 : 0, i = round((x - off) / 14), cx = i * 14 + off, cy = jj * 9 - 4;
    const d = hypot(x - cx, (y - cy) * 1.05) / 9;
    if (d < 1 && y >= cy) {
      best = jj;
      hh = 0.2 + 0.8 * sm(0.1, 0.85, d) * (1 - sm(0.9, 1, d));
      break;
    }
  }
  return best < 0 ? 0 : hh;
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, kind: -1, lamp: 0.06, clock: 0, started: false,
    rel: new Float32Array(N), wipe: new Float32Array(N), hgt: new Float32Array(N),
    gx: new Float32Array(N), gy: new Float32Array(N), gw: new Float32Array(N), gt: new Uint8Array(N),
    swipe: null, nextSwipe: 2.2, swipes: 0, press: -1, pal: new Float32Array(16), palHue: NaN,
  });
  // A shimmer grain under every LED: its facet leans up to 13 degrees off
  // the surface, every way, so the glints gather where the surface itself
  // nearly faces the half vector, along the lit flank of each ridge. Half the
  // grains are bright enough to glint and one in three of those flips to the
  // second tint.
  for (let p = 0; p < N; p++) {
    const a = random() * 2 * PI, t = 0.23 * sqrt(random());
    S.gx[p] = t * cos(a);
    S.gy[p] = t * sin(a);
    const g = random();
    S.gw[p] = g < 0.5 ? 0.5 + 0.5 * random() : 0.1 * random();
    S.gt[p] = random() < 0.33 ? 1 : 0;
  }
}

function setRelief(S, kind) {
  S.kind = kind;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.rel[y * W + x] = relief(kind, x, y);
}

// A swipe: a slightly bent stroke 9 to 13 LEDs wide, mostly up or down the
// panel, entering and leaving near the edges.
function newSwipe() {
  const down = random() < 0.5, x0 = 8 + random() * 48, x1 = 8 + random() * 48;
  const y0 = down ? -6 : H + 6, y1 = down ? 30 + random() * 80 : 98 - random() * 80;
  return {
    x0, y0, x1, y1, bx: (x0 + x1) / 2 + (random() - 0.5) * 40, by: (y0 + y1) / 2,
    r: 4.5 + random() * 2, t: 0, last: 0,
  };
}

function stamp(S, x, y, r) {
  for (let yy = max(0, floor(y - r - 2)); yy <= min(H - 1, y + r + 2); yy++)
    for (let xx = max(0, floor(x - r - 2)); xx <= min(W - 1, x + r + 2); xx++) {
      const d = hypot(xx - x, yy - y), w = 1 - sm(r - 1.5, r + 1.5, d), p = yy * W + xx;
      if (w > S.wipe[p]) S.wipe[p] = w;
    }
}

function stepSwipe(S, ds) {
  const sw = S.swipe;
  sw.t = min(1, sw.t + ds / 0.7);
  // Ease in and out: the fingertip lands, drags and lifts.
  const e = sm(0, 1, sw.t);
  const n = max(1, Math.ceil((e - sw.last) * 120));
  for (let i = 1; i <= n; i++) {
    const u = sw.last + ((e - sw.last) * i) / n, v = 1 - u;
    stamp(S, v * v * sw.x0 + 2 * u * v * sw.bx + u * u * sw.x1, v * v * sw.y0 + 2 * u * v * sw.by + u * u * sw.y1, sw.r * (0.75 + 0.25 * sin(PI * min(1, u * 1.4))));
  }
  sw.last = e;
  if (sw.t >= 1) S.swipe = null;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.lamp = cl(k[3], -1, 1);
  const kind = cl(round(k[2]), 0, 3);
  if (kind !== S.kind) setRelief(S, kind);
  if (!S.started) {
    // Open on a pan that has had one swipe already.
    S.swipe = newSwipe();
    S.swipe.x0 = 14;
    S.swipe.x1 = 50;
    S.swipe.y0 = -6;
    S.swipe.y1 = 92;
    S.swipe.bx = 6;
    while (S.swipe) stepSwipe(S, 0.05);
    S.started = true;
  }
  const ds = (d * S.speed) / 2;
  S.clock += ds;
  if (input.btnPressed && input.btnPressed[0] && S.press < 0) S.press = 0;
  if (S.press >= 0) {
    // The pressing edge runs down from the top in 2.4 s, or 4.8 s at Speed
    // 1 and below, so a tap is never a long wait. Above it every trough is
    // gone; the last 12 rows over it are part way.
    S.press += d * max(0.5, S.speed / 2);
    const y1 = (S.press / 2.4) * (H + 24) - 12;
    for (let y = 0; y < min(H, y1); y++) {
      const keep = sm(y1 - 12, y1, y);
      for (let x = 0; x < W; x++) if (S.wipe[y * W + x] > keep) S.wipe[y * W + x] = keep;
    }
    if (y1 > H + 12) S.press = -1;
  }
  if (S.swipe) stepSwipe(S, ds);
  else if (S.clock >= S.nextSwipe) {
    S.nextSwipe = S.clock + 6.5;
    S.swipes++;
    if (S.swipes % 5 === 0 && S.press < 0) S.press = 0;
    else S.swipe = newSwipe();
  }
}

function palette(S) {
  // At Hue 0 a pink pearl. Where the hue comes round to orange, gold and
  // lime the body is laid paler and brighter and its shaded side leans to
  // rose, as at half light those hues read brown or olive. Elsewhere the
  // shaded side is the same hue a little deeper. The sheen is a pale tint a
  // fourteenth of the wheel on, and the glints come in two tints, the
  // shade's own and one a tenth on, as pearl pigment flips.
  const h = S.hue + 0.9, hh = fr(h), hw = hh > 0.9 ? hh - 1 : hh, warm = sm(-0.05, 0.03, hw) * (1 - sm(0.26, 0.38, hw));
  hsv(h, 0.42 - 0.14 * warm, 0.94 + 0.05 * warm, S.pal, 0);
  hsv(h - 0.12 * warm, 0.56 - 0.04 * warm, 1, S.pal, 3);
  hsv(h + 0.07, 0.3, 1, S.pal, 6);
  hsv(h, 0.22, 1, S.pal, 9);
  hsv(h + 0.1, 0.3, 1, S.pal, 12);
  S.pal[15] = warm;
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const { rel, wipe, hgt, gx, gy, gw, gt, pal } = S;
  // The lamp wanders on a slow Lissajous path over the whole panel, 9 LEDs
  // above it at Lamp -1, 32 at 0.06 and 64 at 1.
  const t = S.clock, lx = 32 + 24 * sin(t * 0.37 + 1.1), ly = 64 + 44 * sin(t * 0.23 + 0.4);
  const lh = 32 + (S.lamp >= 0.06 ? ((S.lamp - 0.06) / 0.94) * 32 : ((S.lamp - 0.06) / 1.06) * 23);
  // Above 0.06 the room light comes up too: a light straight overhead, 2.4
  // times the lamp at Lamp 1, which lights every flank alike and evens out
  // the pool.
  const up = S.lamp > 0.06 ? (S.lamp - 0.06) / 0.94 : 0, over = 2.4 * up, poolLift = 0.4 * up;
  // The eye sways 1.5 degrees, as a shopper's would, so the glints twinkle
  // even while the lamp holds still.
  let ex = 0.026 * sin(t * 2.1), ey = 0.026 * sin(t * 1.7 + 2);
  const en = 1 / sqrt(ex * ex + ey * ey + 1);
  ex *= en;
  ey *= en;
  const ez = en;
  // Height in LEDs: crests stand 2 above the grooves. Under a swipe the
  // emboss is flattened to a trough 0.2 below the grooves, with a low lip of
  // pushed powder at its edge. Under the pressing edge the emboss is pushed
  // down to a sixth over a band 20 rows tall and springs back behind it.
  const py1 = S.press >= 0 ? (S.press / 2.4) * (H + 24) - 12 : -1e9;
  for (let y = 0; y < H; y++) {
    const rise = 1 - 0.85 * (1 - sm(0, 10, abs(y - py1 + 4)));
    for (let x = 0; x < W; x++) {
      const p = y * W + x, w = wipe[p];
      hgt[p] = 2 * (rel[p] * rise * (1 - w) - 0.11 * w + 0.5 * w * (1 - w));
    }
  }
  const warm = pal[15], amb = 0.22 + 0.36 * warm, COSG = cos((7 * PI) / 180);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, h = hgt[p];
      const hx = (x < W - 1 ? hgt[p + 1] : h) - (x > 0 ? hgt[p - 1] : h), hy = (y < H - 1 ? hgt[p + W] : h) - (y > 0 ? hgt[p - W] : h);
      let nx = -hx * 0.5, ny = -hy * 0.5, nz = 1;
      const nn = 1 / sqrt(nx * nx + ny * ny + 1);
      nx *= nn;
      ny *= nn;
      nz *= nn;
      let ldx = lx - x, ldy = ly - y, ldz = lh - h;
      const flat2 = ldx * ldx + ldy * ldy;
      let li = 1 / sqrt(flat2 + ldz * ldz);
      ldx *= li;
      ldy *= li;
      ldz = ldz * li + over;
      li = 1 / sqrt(ldx * ldx + ldy * ldy + ldz * ldz);
      ldx *= li;
      ldy *= li;
      ldz *= li;
      let hvx = ldx + ex, hvy = ldy + ey, hvz = ldz + ez;
      const hn = 1 / sqrt(hvx * hvx + hvy * hvy + hvz * hvz);
      hvx *= hn;
      hvy *= hn;
      hvz *= hn;
      // The lamp's pool: full under it, half 40 LEDs out, never under 0.3.
      const pool = 0.3 + 0.7 / (1 + flat2 / 1600) + poolLift, w = wipe[p];
      // A slope lights by how much more it faces the lamp than the flat
      // powder does (Lambert over the flat's own Lambert), so a low lamp
      // rakes the whole pan, up to 1.7 times the flat on a facing flank and
      // down to a fifth on the far one, while light from overhead lights
      // every flank nearly alike. Rose, orange and yellow keep only 55% of
      // that range, so their dark side never browns.
      const fl = cl((0.7 * (nx * ldx + ny * ldy + nz * ldz)) / max(ldz, 0.12), 0.14, 1.2);
      const lit = pool * (fl + (0.75 - fl) * 0.45 * warm);
      // Satin sheen: broad on the grainy powder and broader still in a
      // trough, where the finger has pressed it smooth and it glows as one.
      const nh = max(0, nx * hvx + ny * hvy + nz * hvz), sheen = pow(nh, 12 - 6 * w) * (0.55 + 0.08 * w) * pool;
      // A grain glints when its facet is within 7 degrees of the half vector.
      const mx = nx + gx[p], my = ny + gy[p], mz = nz, md = (mx * hvx + my * hvy + mz * hvz) / sqrt(mx * mx + my * my + mz * mz);
      let gl = 0;
      if (md > COSG) {
        const q = (md - COSG) / (1 - COSG);
        gl = gw[p] * q * q * (1 - w) * (1 - w) * (0.5 + 0.7 * pool) * 1.6;
      }
      const body = (amb + (1 - amb) * lit) * (0.94 + 0.12 * gw[p]), o = gt[p] ? 12 : 9;
      // Lit faces take the body colour, shaded ones the shade colour, and a
      // trough leans a third of the way to the shade colour.
      const u = cl(lit, 0, 1) * (1 - 0.35 * w), v = 1 - u;
      let r = (pal[0] * u + pal[3] * v) * body + pal[6] * sheen + pal[o] * gl;
      let g = (pal[1] * u + pal[4] * v) * body + pal[7] * sheen + pal[o + 1] * gl;
      let b = (pal[2] * u + pal[5] * v) * body + pal[8] * sheen + pal[o + 2] * gl;
      // Past full brightness the colour is scaled down whole rather than
      // clipped channel by channel, so a glint stays a tint and not white.
      const m = r > g ? (r > b ? r : b) : g > b ? g : b;
      if (m > 1) (r /= m), (g /= m), (b /= m);
      display.setPixel(x, y, 255 * r, 255 * g, 255 * b);
    }
}
