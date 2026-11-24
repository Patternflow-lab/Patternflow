// ===== Patternflow pattern =====
// Title:   Light Leak
// Family:  filmleak
// Idea:    A strip of colour film sits in a camera whose back does not quite close: light creeps in through cracks along the frame's edges and one scratch of a streak, and each dye layer records it with its own scatter, so hot edges blow out to cream with a wide red-orange halation halo, until the film winds on and the old exposure slides away.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the characteristic curve of a photographic emulsion (Ferdinand Hurter and Vero Charles Driffield, 1890, from memory), applied to three dye layers with their own scatter, halation as light that is reflected back off the film base into the layers, and the leaks of a camera back that does not shut; a slow fade stands in for latent-image regression and a meter steers the leaks so the panel neither floods nor goes dark; pattern round 231
// Round:   231
// ===============================
// @matrix 64x128
// @knobs Leak=0..1, Exposure=0.6..3.4, Halation=-1..1, Advance=-1..1
//
// Knob 1: Leak. The colour of the light that gets in, turning from orange at 0 through red, magenta, violet, blue, cyan and green to gold at 1; the leaks on the film sit 0, -48 and +16 degrees from it, so there are always neighbouring hues.
// Knob 2: Exposure. How far up the characteristic curve the film sits, 1.3 stops under the opening at 0.6 to 1.3 stops over at 3.4: under it only the hot edges rise above the toe and stay red, over it the shoulder takes the cores to cream and the washes reach across the panel.
// Knob 3: Halation. The radius of the glow that bounces off the film base into the red and green layers, 2.3 LED at -1, 6 at 0 and 16 at 1, a tight red rim round every edge against a wide red-orange bloom that carries more light.
// Knob 4: Advance. How fast the film is wound on, 1.5 LED a second at -1, 4.5 at 0 and 13.5 at 1: the frame is held and exposes, then the film is whipped down 28 to 52 rows, about every ten seconds at the opening and every four at 1, and each wind brings new leaks.

const W = 64;
const H = 128;
const N = W * H;
const HR = H + 2; // rows of film kept: the panel's 128 and two for the interpolation
const { exp, sqrt, sin, cos, pow, max, min, floor, ceil, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the film
const LIVE = 3; // seconds of a leak's present light that the film shows besides what it has kept
const TAU = 16; // seconds for the latent image to fade by a factor e
const RATE = 1.3; // exposure a second at the hottest part of a leak that is fully on
const SENS = [1.0, 0.66, 0.62]; // red, green, blue layer speed
const SIG = [1.25, 0.9, 0.6]; // LED, scatter inside each layer: red widest, blue sharp
const HALO = [0.8, 0.38, 0]; // share of each layer's exposure that comes back off the base and is added as the halo
const HALO_G = 0.5; // the green layer's halo is this much tighter than the red's
const KNEE = [2.6, 3.0, 2.4]; // steepness of each layer's curve: the toe is what fades an edge into black, and the green and blue layers' later toes leave the first tint red
const DMAX = 0.985;
const FLOOR = 20; // nothing is lit dimmer than this on the panel
const HUE_OFF = [0, -48, 16]; // degrees the three groups of leaks sit from the knob's hue

// ---- the camera back
const DN_MIN = 28; // LED of film a wind takes, at least
const DN_SPAN = 24;
const CREEP = 0.09; // the film is never quite still: this much of the wind speed
const SLOTS = 5; // left, right, top and bottom cracks and one scratch of a streak
const P_ON = [0.95, 0.95, 0.5, 0.45, 0.7];
const P_REROLL = 0.62;
const COVER_GOAL = 0.55; // the share of the panel the leaks of a frame should reach
const COVER_AT = 0.03; // exposure a leak must reach, in units of its strength, to light the panel
const AE_GOAL = 0.6; // the share of the panel the film in the gate should have lit; the leaks wax and wane to hold it
const AE_AT = 0.28;
const AE_RATE = 0.3; // how fast, a second per unit of error
const TRIES = 8; // starts tried for the first picture
const GOOD = 4.5; // and the score that ends the trying

function hueLight(deg, out) {
  // the light's weights at the red, green and blue layers: a saturated hue with a little white in it
  const s = 0.8;
  const hh = (((deg % 360) + 360) % 360) / 60;
  const i = floor(hh);
  const f = hh - i;
  const p = 1 - s, q = 1 - s * f, t = 1 - s * (1 - f);
  let r, g, b;
  if (i === 0) [r, g, b] = [1, t, p];
  else if (i === 1) [r, g, b] = [q, 1, p];
  else if (i === 2) [r, g, b] = [p, 1, t];
  else if (i === 3) [r, g, b] = [p, q, 1];
  else if (i === 4) [r, g, b] = [t, p, 1];
  else [r, g, b] = [1, p, q];
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

// ---- blur: three box passes make a gaussian, edges repeat so a leak that starts at the frame goes on past it
function boxSizes(sigma) {
  const n = 3;
  const wi = sqrt((12 * sigma * sigma) / n + 1);
  let wl = floor(wi);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const r = [];
  for (let i = 0; i < n; i++) r.push(((i < m ? wl : wu) - 1) / 2);
  return r;
}
function boxH(a, b, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let acc = a[o] * (r + 1);
    for (let j = 1; j <= r; j++) acc += a[o + min(j, W - 1)];
    for (let x = 0; x < W; x++) {
      b[o + x] = acc * inv;
      acc += a[o + min(x + r + 1, W - 1)] - a[o + max(x - r, 0)];
    }
  }
}
function boxV(a, b, r) {
  const inv = 1 / (2 * r + 1);
  for (let x = 0; x < W; x++) {
    let acc = a[x] * (r + 1);
    for (let j = 1; j <= r; j++) acc += a[min(j, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      b[y * W + x] = acc * inv;
      acc += a[min(y + r + 1, H - 1) * W + x] - a[max(y - r, 0) * W + x];
    }
  }
}
function blur(S, src, dst, sigma) {
  const rs = boxSizes(sigma);
  const { t1, t2 } = S;
  let from = src;
  let used = false;
  for (const r of rs) {
    if (r < 1) continue;
    boxH(from, t1, r);
    boxV(t1, t2, r);
    from = t2;
    used = true;
  }
  if (!used) dst.set(src);
  else dst.set(t2);
}

// ---- the leaks
function newSlot() {
  return { on: false, str: 0, g: 0, sign: 1, f: new Float32Array(N), y0: 0, y1: -1, b: 0, ph: [0, 0, 0], wf: [0, 0, 0], bias: 0 };
}

function waves(sl) {
  sl.ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
  sl.wf = [0.11 + 0.08 * Math.random(), 0.29 + 0.18 * Math.random(), 0.71 + 0.42 * Math.random()];
  sl.bias = 0.15 + 0.25 * Math.random();
}

// A crack along an edge. The light comes in at a slant and is cut off by a hard line at one end; away from that
// line it thins out, and inward it fades with the depth. Rays of the light trap's fibres modulate it.
function fillEdge(sl, edge) {
  const Le = edge < 2 ? H : W;
  const a = (0.12 + 0.76 * Math.random()) * Le;
  const sg = Math.random() < 0.5 ? -1 : 1;
  const len = (0.3 + 0.35 * Math.random()) * Le;
  const slant = (Math.random() < 0.5 ? -1 : 1) * (0.2 + 0.7 * Math.random());
  const L = (edge < 2 ? 7 : 6) + 6 * Math.random();
  const p1 = Math.random() * 6.28, p2 = Math.random() * 6.28;
  const f = sl.f;
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let d, u;
      if (edge === 0) { d = x + 0.5; u = y + 0.5; }
      else if (edge === 1) { d = W - x - 0.5; u = y + 0.5; }
      else if (edge === 2) { d = y + 0.5; u = x + 0.5; }
      else { d = H - y - 0.5; u = x + 0.5; }
      const up = u - slant * d;
      const w = sg * (up - a);
      const wid = 0.35 + 0.05 * d;
      const hard = sm(-wid, wid, w);
      const tail = exp(-pow(max(0, w) / len, 1.3));
      const ray = 0.88 + 0.12 * sin(0.17 * up + p1) * sin(0.1 * up + p2);
      const v = hard * tail * ray * exp(-pow(d / L, 1.3));
      f[y * W + x] = v;
      if (v > 0.004) {
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  sl.y0 = y0;
  sl.y1 = y1;
}

// A scratch of light across the frame at a steep angle: a narrow core, sharper on one side than the other,
// with a soft glow spilling off the softer side, broken into brighter and dimmer stretches and thinning out at both ends.
function fillStreak(sl, sign) {
  sl.sign = sign;
  const phi = sign * (0.2 + 0.5 * Math.random());
  const px = 12 + 40 * Math.random(), py = 26 + 76 * Math.random();
  const half = 38 + 30 * Math.random();
  const tx = sin(phi), ty = cos(phi), nx = cos(phi), ny = -sin(phi);
  const p = Math.random() * 6.28, q = Math.random() * 6.28;
  const f = sl.f;
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - px, dy = y + 0.5 - py;
      const c = dx * nx + dy * ny;
      const l = dx * tx + dy * ty;
      const wd = 1.7 + 0.6 * sin(0.06 * l + q);
      let prof;
      if (c >= 0) prof = exp(-((c / (1.2 * wd)) ** 2)) + 0.3 * exp(-c / 7);
      else prof = exp(-((c / (0.7 * wd)) ** 2)) + 0.06 * exp(c / 3);
      const seg = 0.3 + 0.7 * sm(-0.5, 0.9, sin(0.115 * l + p) + 0.6 * sin(0.047 * l + q));
      const v = prof * seg * exp(-pow(abs(l) / half, 3));
      f[y * W + x] = v;
      if (v > 0.004) {
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  sl.y0 = y0;
  sl.y1 = y1;
}

// Fill a slot object with a new leak for place i (0 left, 1 right, 2 top, 3 bottom, 4 streak).
function rollInto(sl, i, S) {
  sl.on = true;
  waves(sl);
  const gr = Math.random();
  sl.g = gr < 0.45 ? 0 : gr < 0.75 ? 1 : 2;
  if (i < 4) {
    fillEdge(sl, i);
    sl.str = 0.8 + 0.5 * Math.random();
  } else {
    // the scratch mostly keeps leaning the way the last one did, so two of them run side by side and do not make a cross
    fillStreak(sl, Math.random() < 0.85 ? S.sign : -S.sign);
    sl.str = 1.0 + 0.5 * Math.random();
  }
}

function switchOff(sl) {
  sl.on = false;
  sl.b = 0;
  sl.f.fill(0);
  sl.y0 = 0;
  sl.y1 = -1;
}

// How much of the panel the leaks of the others plus this candidate reach.
function cover(base, c) {
  let n = 0;
  const f = c.f, s = c.str;
  for (let p = 0; p < N; p++) if (base[p] + s * f[p] > COVER_AT) n++;
  return n / N;
}

// A place gets a new leak: three are tried and the one that brings the frame closest to its share of lit panel is kept,
// with a little chance in it so it is not always the same one.
function renew(S, i, force) {
  const on = force || Math.random() < P_ON[i];
  if (!on) {
    switchOff(S.slots[i]);
    return;
  }
  const base = S.sum;
  base.fill(0);
  for (let j = 0; j < SLOTS; j++) {
    const o = S.slots[j];
    if (j === i || !o.on) continue;
    for (let p = 0; p < N; p++) base[p] += o.str * o.f[p];
  }
  let best = -1, bestScore = -1;
  for (let k = 0; k < 3; k++) {
    const c = S.pool[k];
    rollInto(c, i, S);
    const sc = 1 - abs(cover(base, c) - COVER_GOAL) + 0.25 * Math.random();
    if (sc > bestScore) {
      bestScore = sc;
      best = k;
    }
  }
  if (i === 4) S.sign = S.pool[best].sign;
  const old = S.slots[i];
  S.slots[i] = S.pool[best];
  S.pool[best] = old;
}

function reroll(S, all) {
  for (let i = 0; i < SLOTS; i++) if (all || Math.random() < P_REROLL) renew(S, i, all && i < 2);
  // at least one side keeps leaking
  if (!S.slots[0].on && !S.slots[1].on) renew(S, floor(Math.random() * 2), true);
  // a frame with fewer than three leaks is too dim to be worth winding to
  let on = 0;
  for (const sl of S.slots) if (sl.on) on++;
  let guard = 0;
  while (on < 3 && guard++ < 12) {
    const i = floor(Math.random() * SLOTS);
    if (!S.slots[i].on) {
      renew(S, i, true);
      on++;
    }
  }
}

function setupState(params) {
  const S = {
    t: 0,
    warm: false,
    ring: [new Float32Array(HR * W), new Float32Array(HR * W), new Float32Array(HR * W)],
    adv: 0,
    top: 0,
    slots: [],
    pool: [newSlot(), newSlot(), newSlot()],
    phase: 0,
    Dn: DN_MIN + DN_SPAN * Math.random(),
    winding: false,
    wp: 0,
    D: 0,
    wAdv0: 0,
    Tw: 1.8,
    rolled: true,
    ae: 0,
    aeT: 0,
    sign: Math.random() < 0.5 ? -1 : 1,
    winds: 0,
    speed: 4.5,
    rv: 1,
    aeMul: 1,
    gain: 1,
    halo: 6,
    hue: 24,
    wgt: [[1, 0.46, 0.07], [1, 0.46, 0.07], [1, 0.46, 0.07]],
    e0: new Float32Array(N), e1: new Float32Array(N), e2: new Float32Array(N),
    c0: new Float32Array(N), c1: new Float32Array(N), c2: new Float32Array(N),
    t1: new Float32Array(N), t2: new Float32Array(N),
    b0: new Float32Array(N), b1: new Float32Array(N),
    sum: new Float32Array(N),
    out: new Float32Array(N * 3),
  };
  for (let i = 0; i < SLOTS; i++) S.slots.push(newSlot());
  reroll(S, true);
  params.s = S;
}
export function setup(params) {
  setupState(params);
}

const slotOf = (m) => (((m % HR) + HR) % HR) * W;

// Wind the film to a new position; rows that come in at the top are unexposed.
function moveTo(S, adv) {
  S.adv = adv;
  const top = floor(-adv);
  while (S.top > top) {
    S.top--;
    const o = slotOf(S.top);
    for (let g = 0; g < 3; g++) S.ring[g].fill(0, o, o + W);
  }
}

function deposit(S, w, adv) {
  for (let i = 0; i < SLOTS; i++) {
    const sl = S.slots[i];
    if (!sl.on || sl.b < 0.004) continue;
    const amt = RATE * sl.str * sl.b * w * S.rv * S.aeMul;
    const ring = S.ring[sl.g];
    const f = sl.f;
    for (let y = sl.y0; y <= sl.y1; y++) {
      const s = y - adv;
      const m0 = floor(s);
      const fr = s - m0;
      const o0 = slotOf(m0), o1 = slotOf(m0 + 1);
      const a0 = amt * (1 - fr), a1 = amt * fr;
      const fo = y * W;
      for (let x = 0; x < W; x++) {
        const v = f[fo + x];
        ring[o0 + x] += a0 * v;
        ring[o1 + x] += a1 * v;
      }
    }
  }
}

// How much of the film in the gate is lit at the nominal exposure. When it is too little the weather clears and the leaks
// come up; when it is too much they sink, slowly, so a panel does not stay dark or flood.
function meter(S) {
  const r0 = S.ring[0], r1 = S.ring[1], r2 = S.ring[2];
  let n = 0, c = 0;
  for (let y = 0; y < H; y += 2) {
    const o = slotOf(Math.round(y - S.adv));
    for (let x = 0; x < W; x += 2) {
      c++;
      if (r0[o + x] + r1[o + x] + r2[o + x] > AE_AT) n++;
    }
  }
  return n / c;
}

function step(S, h) {
  S.t += h;
  S.aeT += h;
  if (S.aeT >= 0.2) {
    S.ae = cl(S.ae + (AE_GOAL - meter(S)) * AE_RATE * S.aeT, -0.4, 1.0);
    S.aeMul = exp(S.ae);
    S.aeT = 0;
  }
  const t = S.t;
  const a0 = S.adv;
  let a1;
  if (S.winding) {
    S.wp += h / S.Tw;
    const p = min(1, S.wp);
    a1 = S.wAdv0 + S.D * (p - sin(2 * PI * p) / (2 * PI));
    if (!S.rolled && p > 0.45) {
      reroll(S, false);
      S.rolled = true;
    }
    if (S.wp >= 1) {
      S.winding = false;
      S.phase = 0;
      S.Dn = DN_MIN + DN_SPAN * Math.random();
      S.winds++;
    }
  } else {
    a1 = a0 + CREEP * S.speed * h * (1 + 0.45 * sin(0.37 * t) + 0.25 * sin(0.91 * t + 1));
    S.phase += (h * S.speed) / S.Dn;
    if (S.phase >= 1) {
      S.winding = true;
      S.wp = 0;
      S.D = S.Dn;
      S.wAdv0 = a1;
      S.Tw = cl(1.9 * pow(4.5 / S.speed, 0.25), 1.1, 2.6);
      S.rolled = false;
    }
  }
  // the latent image fades a little
  const dec = exp(-h / TAU);
  for (let g = 0; g < 3; g++) {
    const r = S.ring[g];
    for (let i = 0; i < r.length; i++) r[i] *= dec;
  }
  // how bright each leak is: waves that do not divide one another, kept above zero only some of the time
  for (let i = 0; i < SLOTS; i++) {
    const sl = S.slots[i];
    if (!sl.on) {
      sl.b = 0;
      continue;
    }
    const v = 0.5 * sin(sl.wf[0] * t + sl.ph[0]) + 0.35 * sin(sl.wf[1] * t + sl.ph[1]) + 0.25 * sin(sl.wf[2] * t + sl.ph[2]) + sl.bias;
    sl.b = 0.1 + 0.9 * sm(-0.5, 1.15, v);
  }
  // exposure while the film moves is laid down along the way, so a wind is a smear and not a row of copies
  const n = max(1, ceil(abs(a1 - a0) / 0.7));
  for (let k = 0; k < n; k++) {
    const pos = a0 + ((k + 0.5) / n) * (a1 - a0);
    moveTo(S, pos);
    deposit(S, h / n, pos);
  }
  moveTo(S, a1);
}

function advance(S, span) {
  while (span > 1e-9) {
    const h = min(span, 0.05);
    step(S, h);
    span -= h;
  }
}

function setKnobs(S, k) {
  const k0 = cl(k[0], 0, 1);
  S.hue = 24 - 330 * k0;
  for (let g = 0; g < 3; g++) hueLight(S.hue + HUE_OFF[g], S.wgt[g]);
  S.gain = pow(2, (cl(k[1], 0.6, 3.4) - 2) * 0.8);
  S.halo = 6 * pow(2.6, cl(k[2], -1, 1));
  S.speed = 4.5 * pow(3, cl(k[3], -1, 1));
  // a film that moves slowly sits longer in a leak, so it is given a little less per second
  S.rv = pow(S.speed / 4.5, 0.7);
}

// The film as it now lies in the gate, through the three layers, as 0..255 values in S.out.
function render(S) {
  const { c0, c1, c2, e0, e1, e2, b0, b1, wgt, ring, out } = S;
  // each group of leaks read at this fraction of a row
  const r0 = ring[0], r1 = ring[1], r2 = ring[2];
  for (let y = 0; y < H; y++) {
    const s = y - S.adv;
    const m0 = floor(s);
    const fr = s - m0;
    const o0 = slotOf(m0), o1 = slotOf(m0 + 1);
    const q = y * W;
    for (let x = 0; x < W; x++) {
      c0[q + x] = r0[o0 + x] + (r0[o1 + x] - r0[o0 + x]) * fr;
      c1[q + x] = r1[o0 + x] + (r1[o1 + x] - r1[o0 + x]) * fr;
      c2[q + x] = r2[o0 + x] + (r2[o1 + x] - r2[o0 + x]) * fr;
    }
  }
  // and the light that is falling on it at this moment, which stands where the leaks stand and not where the film has got to
  for (let i = 0; i < SLOTS; i++) {
    const sl = S.slots[i];
    if (!sl.on) continue;
    const k = RATE * LIVE * sl.str * sl.b * S.aeMul;
    const c = sl.g === 0 ? c0 : sl.g === 1 ? c1 : c2;
    const f = sl.f;
    for (let p = sl.y0 * W; p < (sl.y1 + 1) * W; p++) c[p] += k * f[p];
  }
  // what each dye layer was exposed to: the groups' light seen through that layer
  const w0 = wgt[0], w1 = wgt[1], w2 = wgt[2];
  for (let p = 0; p < N; p++) {
    const a = c0[p], b = c1[p], c = c2[p];
    e0[p] = w0[0] * a + w1[0] * b + w2[0] * c;
    e1[p] = w0[1] * a + w1[1] * b + w2[1] * c;
    e2[p] = w0[2] * a + w1[2] * b + w2[2] * c;
  }
  // scatter inside each layer, and the halation off the base added to the red and green ones
  blur(S, e0, c0, SIG[0]);
  blur(S, e0, b0, S.halo);
  blur(S, e1, c1, SIG[1]);
  blur(S, e1, b1, S.halo * HALO_G);
  blur(S, e2, c2, SIG[2]);
  const gR = S.gain * SENS[0], gG = S.gain * SENS[1], gB = S.gain * SENS[2];
  // a wider halo carries more: a thick base throws back more light
  const hk = pow(S.halo / 6, 0.25);
  const kR = HALO[0] * hk, kG = HALO[1] * hk;
  const top = 255 * DMAX;
  for (let p = 0; p < N; p++) {
    const xr = (c0[p] + b0[p] * kR) * gR;
    const xg = (c1[p] + b1[p] * kG) * gG;
    const xb = c2[p] * gB;
    // Hill curve: a power-law toe into black and a shoulder that tops out below white
    const a = pow(xr, KNEE[0]), c = pow(xg, KNEE[1]), d = pow(xb, KNEE[2]);
    let r = (top * a) / (1 + a);
    let g = (top * c) / (1 + c);
    let b = (top * d) / (1 + d);
    const m = max(r, g, b);
    if (m < FLOOR) {
      if (m < FLOOR * 0.5) {
        r = g = b = 0;
      } else {
        const s = FLOOR / m;
        r *= s;
        g *= s;
        b *= s;
      }
    }
    out[p * 3] = r;
    out[p * 3 + 1] = g;
    out[p * 3 + 2] = b;
  }
}

// Is this opening worth showing: most of the panel lit but not all of it, some real dark, a few hot cores, every third alive,
// a hard edge or two, and not one flat sheet of red.
function opening(S) {
  const out = S.out;
  const th = [0, 0, 0];
  let lit = 0, dark = 0, hot = 0, flat = 0, hard = 0;
  const per = W * 43;
  for (let p = 0; p < N; p++) {
    const r = out[p * 3], g = out[p * 3 + 1], b = out[p * 3 + 2];
    const m = max(r, g, b);
    if (m > 40) {
      lit++;
      th[min(2, floor(p / per))]++;
    }
    if (m < 24) dark++;
    if (g > 170) hot++;
    if (r > 190 && g < 70 && b < 90) flat++;
    if (p % W < W - 1 && abs(m - max(out[p * 3 + 3], out[p * 3 + 4], out[p * 3 + 5])) > 40) hard++;
    if (p + W < N && abs(m - max(out[(p + W) * 3], out[(p + W) * 3 + 1], out[(p + W) * 3 + 2])) > 40) hard++;
  }
  const sLit = 1 - abs(lit / N - 0.72) / 0.72;
  const sDark = min(1, dark / N / 0.14);
  const sHot = min(1, hot / N / 0.07);
  const sThird = min(1, min(th[0], th[1], th[2]) / per / 0.4);
  const sHard = min(1, hard / N / 0.035);
  return sLit + sDark + sHot + sThird + sHard - 2 * max(0, flat / N - 0.28);
}

function prerun(S) {
  // a film that has been through two winds and sits a little way into its next hold
  let guard = 0;
  while (!(S.winds >= 2 && !S.winding && S.phase >= 0.55) && guard++ < 3000) step(S, 0.1);
}

export function update(dt, input, params) {
  if (!params.s) setupState(params);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  if (!params.s.warm) {
    // open on the best of a few starts, so the first picture is a good one whatever the dice
    let best = null, bestScore = -1;
    for (let a = 0; a < TRIES; a++) {
      if (a > 0) setupState(params);
      const T = params.s;
      // judged at the nominal colour, exposure and halo, so the start does not depend on where those knobs are
      setKnobs(T, [0, 2, 0, k[3]]);
      T.warm = true;
      prerun(T);
      render(T);
      const sc = opening(T);
      if (sc > bestScore) {
        bestScore = sc;
        best = T;
      }
      if (sc >= GOOD) break;
    }
    params.s = best;
  }
  const S = params.s;
  setKnobs(S, k);
  advance(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  render(S);
  const out = S.out;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) display.setPixel(x, y, out[p * 3], out[p * 3 + 1], out[p * 3 + 2]);
}
