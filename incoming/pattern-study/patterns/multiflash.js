// ===== Patternflow pattern =====
// Title:   Multiflash
// Family:  multiflash
// Idea:    A strobe in a dark room fires on batons and hoops tossed tumbling across the panel, and every flash stays on a plate that fades over seconds, so each throw leaves a fan of rods or a tube of ellipses along its parabola, sparse where it flew fast and dense where it hung at the top.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the chronophotographs of Etienne-Jules Marey (1880s) and the multiflash stroboscopic photographs of Harold Edgerton (1930s on), both dates from memory; the plate that never stops exposing and lets each exposure fade whole, the throws that come less often the longer it holds, and the two tints half a turn apart are original; pattern round 253
// Round:   253
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Flash=-1..1, Hold=0..1
//
// Knob 1: Hue. Turns every colour on the plate round the wheel together, old exposures included; it opens on cyan to blue rods and hoops with orange end balls and now and then an orange hoop, and half way round the two tints have changed places.
// Knob 2: Speed. 0.3 to 3, opening at 2. How fast the throw, the fall and the spin run together: a high throw is in the air about 6 s at 0.3, 2.5 s at 2 and 1.9 s at 3. The strobe keeps its own time, so a slow throw is exposed more often and its fan is denser.
// Knob 3: Flash. -1 to 1, opening at 0. The strobe rate on a log scale: 4 flashes a second at -1, 11 at 0 and 30 at 1. At -1 a high throw is about ten separate images; at 1 every frame exposes and the fan closes into a ribbon, each exposure a little dimmer for being one of many.
// Knob 4: Hold. 0 to 1, opening at 0.06. How long an exposure stays on the plate, 2.5 s at 0 to 25 s at 1 on a log scale (2.9 s at the opening). Above about 0.25 the throws come less often as it rises, one every 3 s at 0.5 and one every 10 s at 1, so the plate holds two or three sheaves and never a tangle.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sqrt, exp, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const GRAV = 160;      // LEDs per second squared, in the action's own seconds
const P0 = 1.6;        // what one flash leaves on the plate
const VMAX = 2.8;      // the most the plate holds at one LED
const FADE = 0.7;      // how the light falls as its freshness runs out: 1 is a straight line, less holds longer and then drops
const HUE0 = 0.5;      // the tint the plate opens on
const SS = 44;         // side of the scratch square a body is drawn in

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the scratch square: a body is built in layers, each a union of shapes by signed distance ----
const sd = new Float32Array(SS * SS);
const sc = new Float32Array(SS * SS * 3);
let sox = 0, soy = 0;
let lx0 = 0, ly0 = 0, lx1 = 0, ly1 = 0;       // the layer's box
let ux0 = 0, uy0 = 0, ux1 = 0, uy1 = 0;       // the body's box

function sBegin(cx, cy) {
  sox = floor(cx) - SS / 2; soy = floor(cy) - SS / 2;
  sc.fill(0);
  ux0 = SS; uy0 = SS; ux1 = -1; uy1 = -1;
}
function lBegin() { sd.fill(99); lx0 = SS; ly0 = SS; lx1 = -1; ly1 = -1; }
function grow(xa, ya, xb, yb) {
  if (xa < lx0) lx0 = xa; if (ya < ly0) ly0 = ya; if (xb > lx1) lx1 = xb; if (yb > ly1) ly1 = yb;
}
function segD(x0, y0, x1, y1, hw) {
  x0 -= sox; y0 -= soy; x1 -= sox; y1 -= soy;
  const pad = hw + 1;
  const xa = max(0, floor(min(x0, x1) - pad)), xb = min(SS - 1, ceil(max(x0, x1) + pad));
  const ya = max(0, floor(min(y0, y1) - pad)), yb = min(SS - 1, ceil(max(y0, y1) + pad));
  const dx = x1 - x0, dy = y1 - y0, il = 1 / (dx * dx + dy * dy + 1e-9);
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5 - y0;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0;
      const h = cl((px * dx + py * dy) * il, 0, 1);
      const ex = px - h * dx, ey = py - h * dy;
      const d = sqrt(ex * ex + ey * ey) - hw, i = y * SS + x;
      if (d < sd[i]) sd[i] = d;
    }
  }
  grow(xa, ya, xb, yb);
}
function dotD(cx, cy, rad) {
  cx -= sox; cy -= soy;
  const pad = rad + 1;
  const xa = max(0, floor(cx - pad)), xb = min(SS - 1, ceil(cx + pad));
  const ya = max(0, floor(cy - pad)), yb = min(SS - 1, ceil(cy + pad));
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5 - cy;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - cx;
      const d = sqrt(px * px + py * py) - rad, i = y * SS + x;
      if (d < sd[i]) sd[i] = d;
    }
  }
  grow(xa, ya, xb, yb);
}
// lay the layer over what is there, in one colour
function lEnd(r, g, b) {
  for (let y = ly0; y <= ly1; y++) {
    for (let x = lx0; x <= lx1; x++) {
      const d = sd[y * SS + x];
      if (d >= 0.5) continue;
      const c = d <= -0.5 ? 1 : 0.5 - d, k = 1 - c, i = (y * SS + x) * 3;
      sc[i] = sc[i] * k + r * c; sc[i + 1] = sc[i + 1] * k + g * c; sc[i + 2] = sc[i + 2] * k + b * c;
    }
  }
  if (lx0 < ux0) ux0 = lx0; if (ly0 < uy0) uy0 = ly0; if (lx1 > ux1) ux1 = lx1; if (ly1 > uy1) uy1 = ly1;
}
// add the body to a panel-sized buffer
function expose(buf, gain) {
  const xa = max(ux0, -sox), xb = min(ux1, W - 1 - sox);
  const ya = max(uy0, -soy), yb = min(uy1, H - 1 - soy);
  for (let y = ya; y <= yb; y++) {
    let i = (y * SS + xa) * 3, o = ((y + soy) * W + xa + sox) * 3;
    for (let x = xa; x <= xb; x++, i += 3, o += 3) {
      buf[o] += sc[i] * gain; buf[o + 1] += sc[i + 1] * gain; buf[o + 2] += sc[i + 2] * gain;
    }
  }
}

// expose the plate. Each LED keeps, beside its light, how fresh that light is: 1 when exposed, 0 when it is due to be gone.
// The light falls in a straight line to nothing as the freshness runs out, so a stroke fades whole, edges and all.
function exposePlate(st, gain) {
  const p = st.plate, fr = st.fresh;
  const xa = max(ux0, -sox), xb = min(ux1, W - 1 - sox);
  const ya = max(uy0, -soy), yb = min(uy1, H - 1 - soy);
  for (let y = ya; y <= yb; y++) {
    let i = (y * SS + xa) * 3, j = (y + soy) * W + xa + sox;
    for (let x = xa; x <= xb; x++, i += 3, j++) {
      const r = sc[i] * gain, g = sc[i + 1] * gain, b = sc[i + 2] * gain;
      const mn = r > g ? (r > b ? r : b) : (g > b ? g : b);
      if (mn <= 0) continue;
      const o = j * 3;
      let R = p[o], G = p[o + 1], B = p[o + 2];
      const mo = R > G ? (R > B ? R : B) : (G > B ? G : B);
      // a new exposure covers what lies under it: a little where the tint is the same, so a dense place builds up,
      // and nearly all where it is the other tint, so two tints crossing stay two tints
      const cs = (R * r + G * g + B * b) / sqrt((R * R + G * G + B * B) * (r * r + g * g + b * b) + 1e-12);
      const kk = 1 - (0.9 - 0.6 * cs * cs) * min(1, mn / gain);
      R = R * kk + r; G = G * kk + g; B = B * kk + b;
      const m = R > G ? (R > B ? R : B) : (G > B ? G : B);
      if (m > VMAX) { const q = VMAX / m; R *= q; G *= q; B *= q; }
      p[o] = R; p[o + 1] = G; p[o + 2] = B;
      fr[j] = (mo * kk * fr[j] + mn) / (mo * kk + mn);
    }
  }
}

// ---- a body at one instant of its flight ----
const ca = [0, 0, 0], cb = [0, 0, 0];
function stamp(o, t) {
  const q = t / o.T;
  const cx = o.x0 + o.vx * t, cy = o.y0 + o.vy * t + 0.5 * GRAV * t * t;
  sBegin(cx, cy);
  hsv(o.hue + o.hd * q, 0.95, 1, ca);
  hsv(o.hue + o.hb + o.hd * q, 0.95, 1, cb);
  if (o.kind === 0) {
    // baton: it turns about its centre of mass, which lies nearer the big ball
    const a = o.a0 + o.w * t, ux = cos(a), uy = sin(a);
    const bx = cx + ux * o.lb, by = cy + uy * o.lb, tx = cx - ux * o.ls, ty = cy - uy * o.ls;
    lBegin(); segD(bx - ux * o.rb, by - uy * o.rb, tx + ux * o.rs, ty + uy * o.rs, 1.0); lEnd(ca[0], ca[1], ca[2]);
    lBegin(); dotD(bx, by, o.rb); dotD(tx, ty, o.rs); lEnd(cb[0], cb[1], cb[2]);
  } else {
    // hoop: it tumbles about a diameter, and that diameter turns slowly in the picture
    const th = o.a0 + o.w * t, ps = o.p0 + o.pw * t;
    const ct = cos(th), cp = cos(ps), sp = sin(ps), R = o.R;
    const near = sin(th) > 0 ? 0 : 1;
    for (let pass = 0; pass < 2; pass++) {
      const half = pass === 0 ? 1 - near : near, c = ca, k = pass === 0 ? 0.42 : 1;
      lBegin();
      let px = 0, py = 0;
      for (let j = 0; j <= 12; j++) {
        const s = (half + j / 12) * PI, u = R * cos(s), v = R * sin(s) * ct;
        const x = cx + u * cp - v * sp, y = cy + u * sp + v * cp;
        if (j > 0) segD(px, py, x, y, 1.0);
        px = x; py = y;
      }
      lEnd(c[0] * k, c[1] * k, c[2] * k);
    }
  }
}

// ---- a throw ----
function toss(st) {
  // a hoop needs to travel, or its ellipses pile into a mesh at the top; a baton may go nearly straight up
  const kind = Math.random() < 0.6 ? 0 : 1, vmin = kind === 0 ? 26 : 40, M = 17;
  let b = null, bs = -1;
  for (let c = 0; c < 9; c++) {
    let ya, x0, y0, dir;
    if (Math.random() < (kind === 0 ? 0.6 : 0.35)) {
      // from below the panel, high
      const u = Math.random();
      x0 = kind === 0 ? -2 + 68 * u : u < 0.5 ? -8 + 30 * u : 42 + 30 * u; y0 = H + M;
      dir = x0 < 32 ? 1 : -1;
      ya = 9 + 58 * pow(Math.random(), kind === 0 ? 1.4 : 0.8);
    } else {
      // from beside it, anywhere from a lob across the top to a low toss through the bottom half
      dir = Math.random() < 0.5 ? 1 : -1;
      x0 = dir > 0 ? -M : W + M; y0 = 36 + 90 * Math.random();
      ya = max(9, y0 - 20 - 62 * Math.random());
    }
    const ta = sqrt(2 * (y0 - ya) / GRAV), vy = -GRAV * ta;
    const xa = x0 + dir * max(vmin * ta, (y0 > H ? 12 : 30) + 26 * Math.random());
    const vx = (xa - x0) / ta;
    const T = min(ta + sqrt(2 * (H + M - ya) / GRAV), vx > 0 ? (W + M - x0) / vx : (-M - x0) / vx);
    // keep clear of the last two throws: how near its path runs to theirs
    let s = 0;
    for (let j = 0; j < 8; j++) {
      const t = T * (j + 0.5) / 8, x = x0 + vx * t, y = y0 + vy * t + 0.5 * GRAV * t * t;
      let d = 60;
      for (let i = 0; i < st.rec.length; i++) {
        const r = st.rec[i];
        for (let k = 0; k < 8; k++) {
          const u = r.T * (k + 0.5) / 8;
          const e = Math.hypot(x - r.x0 - r.vx * u, y - r.y0 - r.vy * u - 0.5 * GRAV * u * u) * (1 + 0.6 * i);
          if (e < d) d = e;
        }
      }
      s += d;
    }
    if (xa < 5 || xa > W - 5) s *= 0.4;        // the top of the throw belongs on the panel
    if (s > bs) { bs = s; b = { x0, y0, vx, vy, T }; }
  }
  const o = b;
  o.kind = kind; o.t = 0;
  // the spin, in radians a second of the action: at the opening strobe a baton turns 5 to 23 degrees between flashes,
  // slow enough that its images stand as a fan and not as a zigzag
  o.a0 = TP * Math.random();
  o.w = (kind === 0 ? pow(4.5, Math.random()) : 0.8 + 3.2 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
  const len = 13 + 10 * Math.random();
  o.lb = 0.4 * len; o.ls = 0.6 * len;
  o.rb = 1.8 + 0.5 * Math.random(); o.rs = 1.2 + 0.2 * Math.random();
  o.R = 6.5 + 5 * Math.random();
  o.p0 = PI * Math.random();
  o.pw = TP * (0.1 + 0.4 * Math.random()) * (Math.random() < 0.5 ? -1 : 1) / o.T;
  // two families of tint, about half a turn apart: a body takes one and its end balls the other
  const swap = Math.random() < (kind === 0 ? 0.15 : 0.5);
  const ha = HUE0 - 0.03 + 0.12 * Math.random(), hb = HUE0 + (swap ? 0.585 : 0.625) + 0.04 * Math.random();
  o.hue = swap ? hb : ha; o.hb = swap ? ha - hb : hb - ha;
  o.hd = (swap ? 0.012 : 0.02 + 0.02 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
  o.fT = -1; o.fAge = 9;
  st.rec.unshift(o);
  if (st.rec.length > 2) st.rec.pop();
  return o;
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    plate: new Float32Array(N * 3), fresh: new Float32Array(N), fb: new Float32Array(N * 3),
    objs: [], rec: [], wait: 1, lastT: 2.4, jit: 1, ph: Math.random(),
  });
  return st;
}

const rateOf = (k) => 0.3 + 0.35 * cl(k, 0.3, 3);
const lifeOf = (k) => 2.5 * pow(10, cl(k, 0, 1));

function advance(st, dt) {
  const ks = st.ks;
  const rate = rateOf(ks[1]);
  const f = 11 * exp(1.0116 * cl(ks[2], -1, 1));
  const life = lifeOf(ks[3]);
  const gain = P0 * pow(11 / f, 0.35);          // many exposures are each a little dimmer
  // the next throw: sooner than the last one lands, and less often the longer the plate holds. The wait is counted
  // as a share of itself, so a turn of Speed or Hold shortens or lengthens the wait already running
  st.wait += dt / (max(0.4 * life, min(0.72 * st.lastT / rate, 1.8)) * st.jit);
  if (st.wait >= 1) {
    const o = toss(st);
    st.objs.push(o);
    st.wait -= 1; st.lastT = o.T; st.jit = 0.85 + 0.3 * Math.random();
  }
  // the plate fades
  const p = st.plate, fr = st.fresh, df = dt / life;
  for (let j = 0; j < N; j++) {
    const fo = fr[j];
    if (fo <= 0) continue;
    const fn = fo - df, i = j * 3;
    if (fn <= 0) { fr[j] = 0; p[i] = 0; p[i + 1] = 0; p[i + 2] = 0; } else { const q = pow(fn / fo, FADE); fr[j] = fn; p[i] *= q; p[i + 1] *= q; p[i + 2] *= q; }
  }
  // the flashes that fall inside this frame, each at its own instant
  const ph0 = st.ph, ph1 = ph0 + f * dt;
  for (let n = floor(ph0) + 1; n <= ph1; n++) {
    const s = (n - ph0) / f;
    for (let j = 0; j < st.objs.length; j++) {
      const o = st.objs[j], ts = o.t + rate * s;
      if (ts < 0 || ts > o.T) continue;
      stamp(o, ts);
      exposePlate(st, gain);
      o.fT = ts; o.fAge = -s;
    }
  }
  st.ph = ph1 - floor(ph1);
  for (let j = st.objs.length - 1; j >= 0; j--) {
    const o = st.objs[j];
    o.t += rate * dt; o.fAge += dt;
    if (o.t > o.T) st.objs.splice(j, 1);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // the plate as it would stand had the strobe been running at these knobs
    const n = ceil(min(60, 2.2 * lifeOf(st.k[3]) + 4) * 15);
    for (let i = 0; i < n; i++) advance(st, 1 / 15);
  }
  if (dt > 0) {
    const a = 1 - exp(-dt / 0.25);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
    advance(st, dt);
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const p = st.plate, fb = st.fb;
  // the plate to light: a toe below, a soft shoulder above, and the densest places burn toward white
  for (let i = 0; i < N * 3; i += 3) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const v = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (v <= 0.03) { fb[i] = 0; fb[i + 1] = 0; fb[i + 2] = 0; continue; }
    const q = (1 - exp(-v)) / v;
    const wb = 0.42 * sstep(1.4, VMAX, v);
    const R = r * q, G = g * q, B = b * q;
    fb[i] = R + (1 - R) * wb; fb[i + 1] = G + (1 - G) * wb; fb[i + 2] = B + (1 - B) * wb;
  }
  // the body itself, dim, and the newest flash brighter for an instant
  for (let j = 0; j < st.objs.length; j++) {
    const o = st.objs[j];
    stamp(o, min(o.t, o.T)); expose(fb, 0.22);
    const pop = 0.7 * exp(-max(0, o.fAge) / 0.05);
    if (o.fT >= 0 && pop > 0.02) { stamp(o, o.fT); expose(fb, pop); }
  }
  // turn the colours round the grey axis
  const th = TP * st.ks[0], c = cos(th), s = sin(th) / sqrt(3);
  const A = c + (1 - c) / 3, B2 = (1 - c) / 3 - s, C = (1 - c) / 3 + s;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = fb[i], g = fb[i + 1], b = fb[i + 2];
      const v = r > g ? (r > b ? r : b) : (g > b ? g : b);
      if (v <= 0) { display.setPixel(x, y, 0, 0, 0); continue; }
      let r2 = max(0, A * r + B2 * g + C * b), g2 = max(0, C * r + A * g + B2 * b), b2 = max(0, B2 * r + C * g + A * b);
      const v2 = max(r2, g2, b2, 1e-6), k = min(v, 1) / v2;
      r2 *= k; g2 *= k; b2 *= k;
      // a dim amber is brown on the panel and a dim lime is khaki: as a warm tint fades it runs to red, or to green
      if (b2 < r2 && b2 < g2) {
        const vv = min(v, 1), hi = max(r2, g2), lo = min(r2, g2);
        const nl = hi * pow(lo / hi, 1 + 3.5 * (1 - vv) * (1 - vv) * (1 - vv));
        const m2 = lo + (nl - lo) * (1 - b2 / lo);
        if (r2 < g2) r2 = m2; else g2 = m2;
      }
      // blue is dark on an LED, so it lifts a little
      const lift = max(0, 0.4 * min(v, 1) - (0.3 * r2 + 0.59 * g2 + 0.11 * b2)) * 0.6;
      display.setPixel(x, y, (min(1, r2 + lift) * 255 + 0.5) | 0, (min(1, g2 + lift) * 255 + 0.5) | 0, (min(1, b2 + lift) * 255 + 0.5) | 0);
    }
  }
}
