// ===== Patternflow pattern =====
// Title:   Rain Glass
// Family:  rainglass
// Idea:    A night window in the rain seen from inside, a soft wash of defocused neon lights behind a fogged pane, where every water drop on the glass is a tiny ball lens holding a sharper, brighter, upside-down miniature of the lights behind it, and the drops condense, merge, stick, lurch down the pane and leave clear wet trails.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the rain-on-window bokeh photograph, a raindrop as a wide-angle lens that shows an inverted image of its surroundings (Garg and Nayar, 2007), droplets that merge, stick and run down a pane in jerks (Kaneda and others, 1999), the drop-and-trail shader over a blurred street scene (Martijn Steinrucken, 2017), and Gaussian-edged discs for the lights; pattern round 208
// Round:   208
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rain=0.5..3.5, Fog=-1..1, Slope=0..0.12
//
// Knob 1: Hue. Turns the neon of the lights round the colour wheel together with the navy night behind them. It opens on magenta, cyan and amber with a few pale whites and a red or two, and comes back to that at 1.
// Knob 2: Rain. How fast new drops condense out of the haze and how fast the small ones swell, from a few dozen specks of rain on the glass at 0.5 to a crowded pane at 3.5. It opens at 2, with a few dozen drops from 2 to 8 LEDs across. The pane holds its own count: a drop that gets too big runs off and a crowded glass condenses nothing new.
// Knob 3: Fog. How far the glass between the drops is out of focus and how milky it is. At 0.2 the lights behind are soft discs with a faint lift of mist, at 1 a deep haze that melts them into one colour field, while the drops and their trails stay clear and show the lights crisp.
// Knob 4: Slope. How much the glass is tilted, as how readily a drop lets go and how far it lurches. At 0 every drop clings where it formed. The opening 0.06 sends a drop down once it is about 6 LEDs across, in a lurch every second or so, and at 0.12 even small ones run, in long jerks that leave trails the length of the pane.

const W = 64;
const H = 128;
const NPX = W * H;
const { floor, ceil, sqrt, exp, sin, cos, abs, min, max, PI, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The glass.
const SPAWN = 1.0; // drops condensing a second at Rain 1 on an empty pane
const GROW = 0.03; // LEDs of radius a second a drop swells by, at Rain 1
const RMAX = 4.2; // the largest a clinging drop gets, radius in LEDs
const LOSS = 0.075; // area of water a running drop leaves behind per LED run
const LENS = 2.2; // how many LEDs of the lights a drop shows for each LED of its own radius
const TRAIL_TAU = 4.5; // seconds for a wet trail to fade to a third
const PRE_S = 150; // seconds of rain the first update has already run
const MAXD = 160; // drops, as a safety stop

const PALETTE = [
  // hue, saturation, weight, a pale one (only the small lights take those)
  [0.89, 0.88, 2.2, 0], // magenta
  [0.95, 0.76, 0.5, 0], // pink
  [0.5, 0.92, 3, 0], // cyan
  [0.58, 0.88, 0.6, 0], // azure
  [0.105, 0.96, 4.4, 0], // amber
  [0.77, 0.72, 0.6, 0], // violet
  [0.995, 0.88, 1, 0], // red
  [0.12, 0.16, 1.6, 1], // warm white
  [0.55, 0.13, 1, 1], // cool white
];
const RED = 6;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const rnd = () => Math.random();
const between = (a, b) => a + (b - a) * rnd();

function pickColour(redCount, pale, noRed) {
  for (;;) {
    let tot = 0;
    for (const p of PALETTE) tot += p[2];
    let u = rnd() * tot, k = 0;
    while (k < PALETTE.length - 1 && u > PALETTE[k][2]) u -= PALETTE[k++][2];
    if (PALETTE[k][3] && !pale) continue;
    if (k === RED && (noRed || redCount.n >= 2)) continue;
    if (k === RED) redCount.n++;
    return PALETTE[k];
  }
}

// The lights behind the glass: big discs, middle ones, small bright ones and
// a few long smears, spread by best candidate so none piles on another. A third
// of them slide sideways, slowly, like traffic.
function makeLights() {
  const out = [];
  const reds = { n: 0 };
  const classes = [
    // count, radius range, ratio of ry to rx, brightness range, slide chance
    [10, 7.5, 12.5, 1, 0.7, 1.0, 0.1, 0],
    [20, 4.6, 8, 1, 0.75, 1.05, 0.4, 0],
    [9, 3, 5, 1, 0.9, 1.1, 0.5, 1],
    [3, 13, 19, 0.15, 0.5, 0.7, 0.9, 0],
  ];
  for (const [n, r0, r1, ratio, v0, v1, slide, pale] of classes) {
    for (let i = 0; i < n; i++) {
      const col = pickColour(reds, pale, r1 > 10);
      const rx = between(r0, r1);
      const ry = ratio === 1 ? rx : rx * ratio * between(0.8, 1.3);
      let bx = 0, by = 0, best = -1e9;
      for (let k = 0; k < 14; k++) {
        const x = between(-3, W + 3), y = between(0, H);
        let dm = 1e9;
        for (const o of out) {
          const dx = (o.cx - x) * 0.9, dy = o.cy - y;
          dm = min(dm, sqrt(dx * dx + dy * dy) - 0.45 * (o.rx + rx));
        }
        if (dm > best) {
          best = dm;
          bx = x;
          by = y;
        }
      }
      const sl = rnd() < slide;
      out.push({
        cx: bx,
        cy: by,
        rx,
        ry,
        hue: col[0],
        sat: col[1],
        val: between(v0, v1),
        vx: sl ? between(0.45, 1.9) * (rnd() < 0.5 ? -1 : 1) * (ratio < 1 ? 1.4 : 1) : 0,
        m: rx + 16,
        pw: between(27, 113),
        pp: between(0, TAU),
        rw: between(31, 89),
        rp: between(0, TAU),
        wx: between(41, 137),
        wy: between(43, 131),
        px: between(0, TAU),
        py: between(0, TAU),
        ax: between(1, 3.2),
        ay: between(0.8, 2.4),
      });
    }
  }
  return out;
}

export function setup(params) {
  params.s = {
    t: between(0, 50),
    hue: 0,
    rain: 2,
    fog: 0.5,
    slope: 1,
    ready: false,
    acc: 0,
    cov: 0,
    lights: makeLights(),
    drops: [],
    trail: new Float32Array(NPX),
    fogB: new Float32Array(NPX * 3),
    shB: new Float32Array(NPX * 3),
    lnB: new Float32Array(NPX * 3),
    clB: new Float32Array(NPX * 3),
    fr: new Float32Array(NPX * 3),
    col: [0, 0, 0],
  };
}

// ---------------------------------------------------------------- the drops

function newDrop(x, y, r) {
  return { x, y, r, ox: between(-5, 5), oy: between(-5, 5), xd: x, yd: y, rd: r * 0.5, age: 0, mov: false, v: 0, tau: 0.5, wait: 0, sway: 0, dead: false };
}

function spawn(S) {
  const r0 = 0.9 + 0.8 * rnd() * rnd();
  for (let k = 0; k < 8; k++) {
    const x = rnd() * W, y = rnd() * H;
    let ok = true;
    for (const d of S.drops) {
      const dx = d.x - x, dy = d.y - y, rr = d.r + r0 + 1.4;
      if (dx * dx + dy * dy < rr * rr) {
        ok = false;
        break;
      }
    }
    if (ok) {
      S.drops.push(newDrop(x, y, r0));
      return;
    }
  }
}

// A wet streak: the clearest line a running drop leaves is where it has been.
function stamp(S, x, y0, y1, r) {
  const T = S.trail, sg = 0.65 + 0.11 * r, inv = 1 / (2 * sg * sg);
  const n = max(1, ceil(abs(y1 - y0) / 0.6));
  for (let j = 0; j <= n; j++) {
    const yy = y0 + ((y1 - y0) * j) / n;
    const ya = max(0, floor(yy - 2.4)), yb = min(H - 1, floor(yy + 2.4));
    const xa = max(0, floor(x - 2.4)), xb = min(W - 1, floor(x + 2.4));
    for (let py = ya; py <= yb; py++) {
      const dy = py + 0.5 - yy;
      for (let px = xa; px <= xb; px++) {
        const dx = px + 0.5 - x;
        const v = exp(-(dx * dx + dy * dy) * inv);
        const i = py * W + px;
        if (v > T[i]) T[i] = v;
      }
    }
  }
}

function step(S, d) {
  const drops = S.drops;
  const rain = S.rain, s = S.slope;
  const rc = s < 0.08 ? 99 : 1.9 + 0.9 / sqrt(s); // radius at which a drop lets go
  const covMax = 0.08 + 0.035 * rain;
  const crowd = cl(1 - S.cov / covMax, 0, 1);
  // new drops condense on clear glass
  S.acc += SPAWN * 0.5 * rain * rain * crowd * d;
  while (S.acc >= 1) {
    S.acc -= 1;
    if (drops.length < MAXD) spawn(S);
  }
  const tf = exp(-d / TRAIL_TAU), T = S.trail;
  for (let i = 0; i < NPX; i++) T[i] *= tf;

  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    a.age += d;
    if (!a.mov && a.r < RMAX) a.r += GROW * rain * crowd * d;
    if (a.r > rc) {
      if (a.mov) {
        const dy = a.v * d;
        const y0 = a.y;
        a.y += dy;
        a.x += a.sway * dy;
        a.sway = cl(a.sway * (1 - 2 * d) + (rnd() - 0.5) * 0.9 * d, -0.1, 0.1);
        a.v *= exp(-d / a.tau);
        const m = a.r * a.r - LOSS * dy;
        a.r = sqrt(max(m, 1));
        stamp(S, a.x, y0, a.y, a.r);
        if (rnd() < 0.03 * dy * (a.r - 1.4) && drops.length < MAXD) {
          const b = newDrop(a.x + between(-0.7, 0.7) * a.r, y0 - a.r * 0.4, between(0.85, 1.2));
          b.rd = b.r;
          drops.push(b);
        }
        if (a.v < 1.5 || a.r < rc * 0.9) {
          a.mov = false;
          a.wait = between(0.3, 2.4) / (0.4 + a.r / rc * 0.6) / (0.5 + 0.5 * sqrt(s));
        }
        if (a.y - a.r > H + 1) a.dead = true;
      } else {
        a.wait -= d;
        if (a.wait <= 0) {
          const dist = (3.5 + 6 * (a.r / rc - 1)) * between(0.6, 1.5) * sqrt(s);
          a.tau = between(0.35, 0.7);
          a.v = dist / a.tau;
          a.mov = true;
        }
      }
    } else if (a.mov) {
      a.mov = false;
      a.wait = 0.5;
    }
  }

  // touching drops become one; a running drop swallows what it meets
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    if (a.dead) continue;
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j];
      if (b.dead || a.dead) continue;
      const dx = a.x - b.x, dy = a.y - b.y, rr = (a.r + b.r) * 0.86;
      if (dx * dx + dy * dy >= rr * rr) continue;
      let big = a, small = b;
      if ((b.mov && !a.mov) || (b.mov === a.mov && b.r > a.r)) {
        big = b;
        small = a;
      }
      const ma = big.r * big.r, mb = small.r * small.r;
      if (!big.mov) {
        big.x = (big.x * ma + small.x * mb) / (ma + mb);
        big.y = (big.y * ma + small.y * mb) / (ma + mb);
      }
      big.r = min(sqrt(ma + mb), 4.5);
      big.age = max(big.age, small.age);
      if (!big.mov && big.r > rc && big.wait > 0.5) big.wait = 0.2 + 0.4 * rnd();
      small.dead = true;
    }
  }
  let k = 0, cov = 0;
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    if (a.dead) continue;
    cov += a.r * a.r;
    drops[k++] = a;
  }
  drops.length = k;
  S.cov = (cov * PI) / NPX;
  // the picture follows the water, easing so a merge is a flow and not a jump
  const e = min(1, d * 9);
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    a.xd += (a.x - a.xd) * e;
    a.yd += (a.y - a.yd) * e;
    a.rd += (a.r - a.rd) * min(1, d * 5);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.rain = cl(kn[1], 0.5, 3.5);
  S.fog = (cl(kn[2], -1, 1) + 1) / 2;
  S.slope = cl(kn[3], 0, 0.12) / 0.06;
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let i = 0; i < PRE_S / 0.15; i++) step(S, 0.15);
    for (const a of S.drops) {
      a.xd = a.x;
      a.yd = a.y;
      a.rd = a.r;
    }
  }
  S.t += d;
  step(S, d);
}

// -------------------------------------------------------------- the lights

// One soft disc or smear, added into a buffer: 1 inside, 0 outside, an edge
// 2 b wide, measured as distance from the true edge of the ellipse.
function splat(buf, cx, cy, rx, ry, b, r, g, bl) {
  const ex = rx + b + 1, ey = ry + b + 1;
  const x0 = max(0, floor(cx - ex)), x1 = min(W - 1, ceil(cx + ex));
  const y0 = max(0, floor(cy - ey)), y1 = min(H - 1, ceil(cy + ey));
  const circle = rx === ry, ib = 1 / (2 * b), ix2 = 1 / (rx * rx), iy2 = 1 / (ry * ry);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      let sd;
      if (circle) sd = sqrt(dx * dx + dy * dy) - rx;
      else {
        const q = dx * dx * ix2 + dy * dy * iy2;
        if (q < 1e-6) sd = -min(rx, ry);
        else sd = ((sqrt(q) - 1) * sqrt(q)) / sqrt(dx * dx * ix2 * ix2 + dy * dy * iy2 * iy2);
      }
      if (sd >= b) continue;
      let t = (sd + b) * ib;
      t = t < 0 ? 0 : t;
      const w = 1 - t * t * (3 - 2 * t);
      const i = (y * W + x) * 3;
      buf[i] += r * w;
      buf[i + 1] += g * w;
      buf[i + 2] += bl * w;
    }
  }
}

function sample(buf, sx, sy, out) {
  const fx = cl(sx - 0.5, 0, W - 1.001), fy = cl(sy - 0.5, 0, H - 1.001);
  const x0 = floor(fx), y0 = floor(fy), ax = fx - x0, ay = fy - y0;
  const i = (y0 * W + x0) * 3, j = i + W * 3;
  const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
  out[0] = buf[i] * w00 + buf[i + 3] * w10 + buf[j] * w01 + buf[j + 3] * w11;
  out[1] = buf[i + 1] * w00 + buf[i + 4] * w10 + buf[j + 1] * w01 + buf[j + 4] * w11;
  out[2] = buf[i + 2] * w00 + buf[i + 5] * w10 + buf[j + 2] * w01 + buf[j + 5] * w11;
}

const GX = -0.62, GY = -0.78; // where the glint sits on a drop: up and to the left

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t, hue = S.hue, f = S.fog;
  const fogB = S.fogB, shB = S.shB, lnB = S.lnB, clB = S.clB, fr = S.fr, T = S.trail;
  const rgb = S.col;
  const bf = 1.6 + 8 * f; // half width of the edge of a light through the fogged glass
  const bs = 0.8; // through a clear drop
  const bc = 1.2 + 2 * f; // and through a wet trail, which is clear but a little soft

  // the night behind the glass
  const nv = [0, 0, 0];
  hsv(0.64 + hue, 0.8, 1, nv);
  for (let y = 0; y < H; y++) {
    const g = 0.03 + 0.02 * (y / H);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      fogB[i] = shB[i] = clB[i] = nv[0] * g * 0.55;
      fogB[i + 1] = shB[i + 1] = clB[i + 1] = nv[1] * g * 0.7;
      fogB[i + 2] = shB[i + 2] = clB[i + 2] = nv[2] * g * 1.5;
    }
  }
  for (const L of S.lights) {
    const pulse = 0.76 + 0.24 * sin((TAU * t) / L.pw + L.pp);
    const rs = 1 + 0.06 * sin((TAU * t) / L.rw + L.rp);
    const W2 = W + 2 * L.m;
    let x = L.cx + L.vx * t + L.m;
    x = ((x % W2) + W2) % W2 - L.m;
    x += L.ax * sin((TAU * t) / L.wx + L.px);
    const y = L.cy + L.ay * sin((TAU * t) / L.wy + L.py);
    hsv(L.hue + hue, L.sat, 1, rgb);
    // blue and red carry less light than yellow and cyan; even them out so the palette keeps its balance as it turns
    const lum = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2];
    const sc = L.val * pulse * cl(pow(0.66 / lum, 0.5), 0.95, 1.3);
    rgb[0] *= sc;
    rgb[1] *= sc;
    rgb[2] *= sc;
    splat(fogB, x, y, L.rx * rs, L.ry * rs, bf, rgb[0], rgb[1], rgb[2]);
    splat(shB, x, y, L.rx * rs, L.ry * rs, bs, rgb[0], rgb[1], rgb[2]);
    splat(clB, x, y, L.rx * rs, L.ry * rs, bc, rgb[0], rgb[1], rgb[2]);
  }

  // what a drop sees: the lights crisp, with a share of their halos so that it holds light where they thin out
  for (let i = 0; i < NPX * 3; i++) lnB[i] = shB[i] + 0.5 * fogB[i];

  // the fogged glass: the lights blurred, dimmed and lifted with mist
  hsv(0.62 + hue, 0.4, 1, nv);
  const mist = 0.02 + 0.13 * f, dim = 0.7 - 0.18 * f;
  const m0 = nv[0] * mist, m1 = nv[1] * mist, m2 = nv[2] * mist;
  for (let i = 0, p = 0; p < NPX; p++, i += 3) {
    const w = T[p] > 0.02 ? min(1, T[p] * 1.1) * 0.9 : 0;
    const tg = 1.45;
    fr[i] = (fogB[i] * dim + m0) * (1 - w) + (clB[i] * tg + 0.03) * w;
    fr[i + 1] = (fogB[i + 1] * dim + m1) * (1 - w) + (clB[i + 1] * tg + 0.04) * w;
    fr[i + 2] = (fogB[i + 2] * dim + m2) * (1 - w) + (clB[i + 2] * tg + 0.07) * w;
  }

  // the drops, each a small lens
  const sp = [0, 0, 0];
  for (const a of S.drops) {
    const R = a.rd;
    if (R < 0.4) continue;
    const mv = a.mov ? cl(a.v / 16, 0, 1) : 0;
    const rx = R * (1 - 0.06 * mv), ry = R * (1 + 0.32 * mv);
    const cx = a.xd, cy = a.yd;
    const big = sm(1.1, 2.6, R);
    const alpha = sm(0, 2.5, a.age) * (0.2 + 0.8 * sm(0.7, 2.0, R)) * (0.3 + 0.7 * big);
    const ew = 1.15 + 0.9 * (1 - big); // the smallest are soft blobs
    if (alpha <= 0) continue;
    const rim = cl((R - 1.2) / 1.5, 0, 1) * 0.62;
    const gl = sm(1.6, 3.2, R);
    const x0 = max(0, floor(cx - rx - 2)), x1 = min(W - 1, ceil(cx + rx + 2));
    const y0 = max(0, floor(cy - ry - 2)), y1 = min(H - 1, ceil(cy + ry + 2));
    const rr = sqrt(rx * ry);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const u = dx / rx, v = dy / ry;
        const q = sqrt(u * u + v * v);
        const sd = (q - 1) * rr;
        const cov = cl(0.5 - sd / ew, 0, 1);
        if (cov <= 0) continue;
        const k = LENS * (1 + 0.5 * q * q);
        sample(lnB, cx + a.ox - dx * k, cy + a.oy - dy * k, sp);
        const ein = -sd;
        const dk = 1 - rim * exp(-((ein - 0.5) * (ein - 0.5)) / 0.6);
        const w = cov * alpha;
        const i = (y * W + x) * 3;
        const gain = (0.85 + 0.6 * big + 0.3 * (v < -1 ? -1 : v > 1 ? 1 : v)) * dk;
        // light the bead takes in from the glass round it, so it never reads as a hole
        let l0 = sp[0] * gain + 0.07 * dk, l1 = sp[1] * gain + 0.08 * dk, l2 = sp[2] * gain + 0.13 * dk;
        let hi = 0;
        if (gl > 0 && q > 0.01) {
          const c = (u * GX + v * GY) / q;
          hi = sm(0.5, 0.95, q) * sm(0.7, 0.97, c) * gl * 0.9;
          const bx = u - 0.45, by = v - 0.5;
          hi += exp(-(bx * bx + by * by) / 0.1) * 0.16 * gl;
        }
        l0 += hi;
        l1 += hi;
        l2 += hi;
        fr[i] = fr[i] * (1 - w) + l0 * w;
        fr[i + 1] = fr[i + 1] * (1 - w) + l1 * w;
        fr[i + 2] = fr[i + 2] * (1 - w) + l2 * w;
      }
    }
  }

  // to the panel: a soft knee keeps the hue of the brightest overlaps
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 3) {
      let r = fr[i], g = fr[i + 1], b = fr[i + 2];
      const m = max(r, g, b);
      if (m > 0.68) {
        const kk = (0.68 + 0.32 * (1 - exp(-(m - 0.68) / 0.32))) / m;
        r *= kk;
        g *= kk;
        b *= kk;
      }
      display.setPixel(x, y, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
    }
  }
}
