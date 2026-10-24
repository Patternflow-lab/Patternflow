// ===== Patternflow pattern =====
// Title:   Essence Drop
// Family:  cosmetic
// Idea:    In slow motion a bead of essence falls into a clear tinted pool, throws up a crown that sheds droplets, opens a cavity that snaps shut into a jet whose tip pinches off and falls back, while ripples carry glints along the glossy surface and the drop's deeper colour curls down through the pool as a vortex ring and slowly melts into it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 33, after slow-motion film of a drop falling into clear essence
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Viscosity=0..1, Size=0..1
//
// Knob 1: Hue. The essence's colour, all the way round the wheel from aqua at 0. From about 0.42 to 0.8, rose through orange and gold to lime, the backdrop and the pool are lifted towards cream and paled so they read rose, peach, champagne, butter or pale lime, never brown or olive, and the bloom glows brighter than the pool instead of darker.
// Knob 2: Speed. How slow the film runs: at 2 a drop takes 1.4 s to fall, lands every 5.5 s, and its crown, cavity and jet are over in 2.4 s while the bloom sinks for about 3 s more; at 0.2 all of it is ten times slower.
// Knob 3: Viscosity. Watery at 0: a crown of nine fingers throws its beads, and a jet eight and a half drop radii high pinches off a bead. Turned up, the fingers go by 0.5 and the crown by 0.7, the jet shortens to a round mound with no bead, the drop sinks in on a thick neck, the thread behind it stretches long, everything runs up to 2.3 times slower, drops come every 7.7 s, the pool holds more colour and the bloom sinks as a slow compact plume.
// Knob 4: Size. The drop's radius, 3.4 LEDs at 0, 3.7 at the start and 7.6 at 1, and the crown, the cavity, the jet and the bloom with it; the jet stops at 48 LEDs.
// Buttons: K1 tap lets a drop fall now.

const W = 64, H = 128, N = W * H, Y0 = 66;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const smin = (a, b, k) => {
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
};
// Light comes from the upper left.
const LX = -0.55, LY = -0.835;
const MAXP = 2000;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, visc: 0, size: 0.06, next: 0.4, T: 0,
    ev: [], dye: new Float32Array(N), deep: new Float32Array(N), dt2: new Float32Array(N), sdf: new Float32Array(N), rip: new Float32Array(W),
    px: new Float32Array(MAXP), py: new Float32Array(MAXP), pa: new Float32Array(MAXP), pe: new Int32Array(MAXP), np: 0,
    circ: [], caps: [], pal: new Float32Array(13), palKey: NaN,
  };
}

function spawn(S) {
  const r = 3.4 + 4.2 * S.size, R = Math.random;
  const x = 32 + (R() - 0.5) * 10;
  // Nine fingers round the front of the crown, each its own length, and the
  // beads they throw each their own speed, so the spray fans out.
  const fing = [];
  for (let j = 0; j < 9; j++) fing.push([PI * (j + 0.5 + 0.35 * (R() - 0.5)) / 9, 0.6 + 0.65 * R(), 7 + 6 * R(), 4 + 5 * R()]);
  S.ev.push({ id: (S.idn = (S.idn || 0) + 1), x, r, te: 0, Tf: 1.4 * (1 + 0.5 * S.visc), dyed: false, ga: 0, a: 0, yv: 0, fing });
  if (S.ev.length > 4) S.ev.shift();
}

// The phases of one splash, as functions of tau, the seconds since impact on
// the film's own clock: the cavity opens and shuts by 0.9, the crown stands
// by 0.35 and falls by 1.1, the jet rises from 0.85 and is gone by 2.35.
const TC = 0.9, TCR = 1.1, TJ0 = 0.85, TJ = 1.5, TPINCH = 0.42;
function slowOf(v) {
  return 1 + 1.3 * v;
}

// The dye: when the drop goes under, a blob of particles is set in the
// velocity field of a vortex pair, the cross-section of a vortex ring. The
// pair moves down at U = G / (4 pi a), slowing as G decays and widening as it
// slows, and the particles wind into its two curls and trail a stem.
function stepDye(S, dts) {
  const v = S.visc;
  for (const e of S.ev) {
    const tau = (e.te - e.Tf) / slowOf(v);
    if (tau < 0.08) continue;
    if (!e.dyed) {
      e.dyed = true;
      e.a = 1.7 * e.r;
      e.yv = Y0 + 2 * e.r;
      e.ga = 4 * PI * e.a * (13 + 1.4 * e.r) * (1 - 0.55 * v);
      const n = floor(160 + 40 * e.r);
      for (let i = 0; i < n; i++) {
        if (S.np >= MAXP) break;
        const ang = Math.random() * 2 * PI, rad = sqrt(Math.random()) * 1.9 * e.r;
        S.px[S.np] = e.x + cos(ang) * rad;
        S.py[S.np] = Y0 + 1.6 * e.r + sin(ang) * rad * 0.8;
        S.pa[S.np] = 0;
        S.pe[S.np] = e.id;
        S.np++;
      }
    }
    // Viscosity eats the ring: its spin decays over 2.8 s in water, 1.5 s in gel.
    e.ga *= exp(-dts / (2.8 - 1.3 * v));
    const U = e.ga / (4 * PI * e.a);
    e.yv += U * dts;
    e.a += 0.3 * e.r * dts * (1 - 0.6 * v);
  }
  const dye = S.dye;
  let k = 0;
  for (let i = 0; i < S.np; i++) {
    let e = null;
    for (const f of S.ev) if (f.id === S.pe[i]) e = f;
    let x = S.px[i], y = S.py[i];
    const age = (S.pa[i] += dts);
    if (!e || age > 12) continue;
    // Two Lamb-Oseen cores, opposite spins, the fluid between them going down.
    let ux = 0, uy = 0;
    const d2 = (0.85 * e.a) ** 2;
    for (let s = -1; s <= 1; s += 2) {
      const dx = x - (e.x + s * e.a), dy = y - e.yv, g = (-s * e.ga) / (2 * PI * (dx * dx + dy * dy + d2));
      ux += -g * dy;
      uy += g * dx;
    }
    x += (ux + (Math.random() - 0.5) * 7) * dts;
    y += (uy + (Math.random() - 0.5) * 7) * dts;
    x = cl(x, 0.5, W - 1.5);
    y = cl(y, Y0 + 1, H - 1.5);
    // Each particle leaves colour where it passes, less as it ages, so the
    // curls show where it went and the old colour spreads out.
    const w = dts * 1.4 * exp(-age / 5), ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, o = iy * W + ix;
    dye[o] += w * (1 - fx) * (1 - fy);
    dye[o + 1] += w * fx * (1 - fy);
    dye[o + W] += w * (1 - fx) * fy;
    dye[o + W + 1] += w * fx * fy;
    S.px[k] = x;
    S.py[k] = y;
    S.pa[k] = age;
    S.pe[k] = S.pe[i];
    k++;
  }
  S.np = k;
  // Diffusion and a slow fade into the pool: a gel holds the colour longer.
  const t2 = S.dt2, kap = cl(dts * (1.6 - 1.1 * v), 0, 0.24), fade = exp(-dts / (7 + 5 * v));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, c = dye[i];
      const l = (x > 0 ? dye[i - 1] : c) + (x < W - 1 ? dye[i + 1] : c) + (y > 0 ? dye[i - W] : c) + (y < H - 1 ? dye[i + W] : c) - 4 * c;
      t2[i] = (c + kap * l) * fade;
    }
  dye.set(t2);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.visc = cl(k[2] || 0, 0, 1);
  S.size = cl(k[3], 0, 1);
  const dts = (d * S.speed) / 2;
  S.T += dts;
  if (input.btnPressed && input.btnPressed[0]) spawn(S);
  S.next -= dts;
  if (S.next <= 0) {
    spawn(S);
    S.next += 5.5 * (1 + 0.4 * S.visc);
  }
  for (const e of S.ev) e.te += dts;
  S.ev = S.ev.filter((e) => e.te - e.Tf < 16 * slowOf(S.visc));
  stepDye(S, dts);
}

// Shapes for the frame: circles and tapered capsules, each smooth-joined to
// the pool so a bead touching the surface melts into it.
function build(S) {
  const C = (S.circ = []), K = (S.caps = []), v = S.visc, rip = S.rip;
  rip.fill(0);
  S.cav = [];
  S.crowns = [];
  for (const e of S.ev) {
    const r = e.r, x0 = e.x;
    if (e.te < e.Tf) {
      // Falling, faster and faster. The drop hangs from a thread out of the
      // top; the thread stretches, breaks (later the thicker the essence) and
      // its lower end balls up into a small bead that trails the drop.
      const u = e.te / e.Tf, yb = -2 * r - 4 + (Y0 + 2 * r + 4) * (0.3 * u + 0.7 * u * u), cy = yb - r;
      C.push([x0, cy, r, 1.4, 1]);
      const tb = 0.45 + 0.42 * v;
      if (u < tb) K.push([x0, cy - 0.5 * r, x0, -6, 0.42 * r, 0.12 * r * (1 + v), 1.6, 1]);
      else {
        const f = (u - tb) / (1 - tb), sy = cy - r - 2 - (6 + 14 * v) * sqrt(f);
        C.push([x0, sy, 0.32 * r, 1, 1]);
        K.push([x0, -6, x0, -6 + (cy - 12 + 6) * max(0, 1 - 3 * f), 0.15 * r, 0.12 * r, 1, 1]);
      }
      continue;
    }
    const tau = (e.te - e.Tf) / slowOf(v);
    // The drop sinks into the surface instead of vanishing at the touch: in a
    // gel it takes 0.75 s and a thick neck joins it to the pool.
    const ts = 0.15 + 0.6 * v;
    if (tau < ts) C.push([x0, Y0 - r + 2.2 * r * (tau / ts), r * (1 - 0.3 * (tau / ts)), 1.4 + 3 * v, 1]);
    // Ripples: a packet from the impact and a smaller one when the jet falls,
    // running out along the surface at 9 LEDs a second, 4 in a gel, about
    // nine LEDs from crest to crest.
    for (const [t0, a0] of [[0, 0.9 * (1 - 0.6 * v)], [TJ0 + TJ * 0.8, 0.45 * (1 - 0.7 * v)]]) {
      const tt = tau - t0;
      if (tt <= 0) continue;
      const c = 9 - 5 * v, A = (a0 * r * exp(-tt / 1.8)) / 3.6;
      for (let x = 0; x < W; x++) {
        const s = abs(x + 0.5 - x0) - c * tt - 2, en = exp(-(s * s) / 60);
        if (en > 0.01) rip[x] += A * en * sin(s * 0.7);
      }
    }
    // The cavity: an air pocket pushed down under the surface.
    if (tau < TC) {
      const Rc = r * (1.2 + 1.3 * (1 - exp(-tau / 0.18))) * (1 - 0.3 * v), Dc = r * 2.5 * (1 - 0.55 * v) * sin((PI * tau) / TC);
      if (Dc > 0.3) S.cav.push([x0, Rc, Dc]);
    }
    // The crown: two thin walls leaning out, a translucent sheet between
    // them, and fingers round the rim whose beads fly off at 0.42.
    const hc = r * 3.1 * max(0, 1 - v / 0.7), R = r * (1.4 + 1.5 * (1 - exp(-min(tau, TCR) / 0.25)));
    if (hc > 0.2 && tau < TCR) {
      const Hc = hc * Math.pow(sin((PI * tau) / TCR), 0.6), fl = 0.35 * Hc;
      if (Hc > 0.5) {
        for (let s = -1; s <= 1; s += 2) K.push([x0 + s * R, Y0 + 1, x0 + s * (R + fl), Y0 - Hc, 0.75, 0.5, 1.2]);
        S.crowns.push([x0, R, fl, Hc]);
        if (tau < 0.42 && v < 0.5) {
          const g = sm(tau / 0.3) * (1 - v / 0.5);
          for (const [ph, lk] of e.fing) {
            const cs = cos(ph), bx = x0 + (R + fl) * cs, lf = lk * 0.55 * hc * g, tx = bx + 0.35 * lf * cs, ty = Y0 - Hc - lf;
            K.push([bx, Y0 - Hc + 0.5, tx, ty, 0.5, 0.3, 0.9]);
            C.push([tx, ty, 0.26 * r, 0.9]);
          }
        }
      }
    }
    if (tau >= 0.42 && v < 0.5) {
      // The beads thrown from the fingers fly out and up, slow, and drop back.
      const t = tau - 0.42, Hp = hc * Math.pow(sin((PI * 0.42) / TCR), 0.6), Rp = r * (1.4 + 1.5 * (1 - exp(-0.42 / 0.25))) + 0.35 * Hp;
      for (const [ph, lk, vy, vx] of e.fing) {
        const cs = cos(ph), lf = lk * 0.55 * hc * (1 - v / 0.5);
        const y = Y0 - Hp - lf - vy * t + 16 * t * t, x = x0 + (Rp + 0.35 * lf) * cs + vx * cs * t;
        if (y < Y0 + 2) C.push([x, y, 0.26 * r * (1 - v / 0.5), 0.9]);
      }
    }
    // The jet: when the cavity snaps shut a column climbs out of the middle;
    // in water its tip pinches off into a bead that flies on and falls back.
    if (tau > TJ0) {
      const s = (tau - TJ0) / TJ, hj = min(48, r * 8.5) * (1 - 0.8 * v), rb = 0.85 * r * (1 + 0.8 * v), pinch = v < 0.55;
      if (s < 1) {
        const Hj = hj * sin(PI * s);
        const top = Y0 - Hj;
        K.push([x0, Y0 + 3, x0, top, rb, (0.5 + 0.5 * v) * r, 2.5 + 2.5 * v]);
        if (!pinch || s < TPINCH) C.push([x0, top - 0.3 * r, (0.7 + 0.3 * v) * r, 1.3 + 2 * v]);
      }
      if (pinch && s >= TPINCH) {
        const t = (s - TPINCH) * TJ, Hp = hj * sin(PI * TPINCH), y = Y0 - Hp - 0.9 * r - 7 * t + 18 * t * t;
        if (y < Y0 + 2) C.push([x0, y, 0.68 * r, 1.3]);
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  build(S);
  const sdf = S.sdf, rip = S.rip, v = S.visc, deep = S.deep;
  // The liquid's signed distance: negative inside. The pool's surface,
  // minus the cavities, then every shape joined on smoothly. The falling drop
  // is the concentrated essence, so where it is the colour is deep.
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) sdf[i] = Y0 + rip[x] - (y + 0.5);
  deep.fill(0);
  for (const [cx, R, D] of S.cav)
    for (let y = Y0 - 2; y < min(H, Y0 + D + 3); y++)
      for (let x = max(0, floor(cx - R - 3)); x < min(W, cx + R + 3); x++) {
        const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - Y0) / D, da = (sqrt(dx * dx + dy * dy) - 1) * min(R, D), i = y * W + x;
        sdf[i] = -smin(-sdf[i], da, 1.5);
      }
  for (const [ax, ay, bx, by, ra, rb, k, dp] of S.caps) {
    const x0 = max(0, floor(min(ax, bx) - ra - k - 1)), x1 = min(W - 1, floor(max(ax, bx) + ra + k + 1));
    const y0 = max(0, floor(min(ay, by) - ra - k - 1)), y1 = min(H - 1, floor(max(ay, by) + ra + k + 1));
    const ex = bx - ax, ey = by - ay, ll = ex * ex + ey * ey || 1;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5 - ax, qy = y + 0.5 - ay, t = cl((qx * ex + qy * ey) / ll, 0, 1);
        const dd = Math.hypot(qx - ex * t, qy - ey * t) - (ra + (rb - ra) * t), i = y * W + x;
        sdf[i] = smin(sdf[i], dd, k);
        if (dp) deep[i] = max(deep[i], cl(1 - dd, 0, 1));
      }
  }
  for (const [cx, cy, r, k, dp] of S.circ) {
    const x0 = max(0, floor(cx - r - k - 1)), x1 = min(W - 1, floor(cx + r + k + 1)), y0 = max(0, floor(cy - r - k - 1)), y1 = min(H - 1, floor(cy + r + k + 1));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r;
        sdf[i] = smin(sdf[i], dd, k);
        if (dp) deep[i] = max(deep[i], cl(1 - dd, 0, 1));
      }
  }
  // Palette: backdrop, essence, and the deep colour the drop carries. A
  // thicker essence holds more colour. From rose through orange and gold to
  // lime, hue -0.12 to 0.35, any of these at half brightness reads brown,
  // khaki or olive on the LEDs, so there everything is lifted towards cream
  // and paled: the backdrop to 200 of 255 or more with a shallow vignette, the
  // pool to about 215, and the deep colour goes brighter than the pool
  // instead of darker.
  const pal = S.pal, h = S.hue + 0.52, hf = h - floor(h), key = hf + 7 * v;
  if (S.palKey !== key) {
    const hw = hf > 0.5 ? hf - 1 : hf, wm = sm((hw + 0.12) / 0.06) * (1 - sm((hw - 0.28) / 0.07));
    hsv(h + 0.02, 0.14 - 0.06 * wm, 1, pal, 0);
    hsv(h + 0.06 * (1 - wm), 0.4 - 0.3 * wm, 1, pal, 10);
    hsv(h, (0.38 + 0.22 * v) * (1 - 0.5 * wm), 1, pal, 3);
    hsv(h + 0.015, 0.92 - 0.3 * wm, 1, pal, 6);
    pal[9] = wm;
    S.palKey = key;
  }
  const wm = pal[9], dv = 0.46 + 0.5 * wm, dye = S.dye, T = S.T;
  for (let y = 0, i = 0; y < H; y++) {
    const below = y + 0.5 - Y0;
    for (let x = 0; x < W; x++, i++) {
      const d = sdf[i];
      // The backdrop: a soft key light high in the middle, deepening towards
      // the surface.
      const gx = (x + 0.5 - 32) / 32, gy = (y - 14) / 46;
      const gl = exp(-(gx * gx + gy * gy)), bv = min(1, 0.4 + 0.46 * gl + wm * (0.36 - 0.26 * gl));
      let r = (pal[10] + (pal[0] - pal[10]) * gl) * bv, g = (pal[11] + (pal[1] - pal[11]) * gl) * bv, b = (pal[12] + (pal[2] - pal[12]) * gl) * bv;
      // The crown's sheet: thin film between its walls, brighter at the two
      // sides where the eye looks along it, and along the lip.
      for (const [cx, R, fl, Hc] of S.crowns) {
        const hgt = -below;
        if (hgt < -0.5 || hgt > Hc) continue;
        const Rh = R + (fl * hgt) / Hc, u = abs(x + 0.5 - cx) / Rh;
        if (u >= 1) continue;
        const a = 0.16 + 0.3 * min(1, 1 / sqrt(1 - u * u) - 1) + 0.4 * exp(-((hgt - Hc + 0.6) ** 2));
        r += (pal[3] * 0.92 - r) * a;
        g += (pal[4] * 0.92 - g) * a;
        b += (pal[5] * 0.92 - b) * a;
      }
      // The open surface, seen edge on: a gloss line along it, glinting white
      // where a ripple tilts it towards the light. It is drawn across the
      // boundary, so it does not flicker as the surface moves by a fraction.
      const pd = Y0 + rip[x] - (y + 0.5), open = abs(d - pd) < 0.02;
      let spec = 0;
      if (open && abs(pd) < 2.5) {
        const sl = ((x < W - 1 ? rip[x + 1] : rip[x]) - (x > 0 ? rip[x - 1] : rip[x])) / 2, nd = (sl * LX - LY) / sqrt(1 + sl * sl);
        spec = exp(-((pd + 0.3) ** 2) / 0.45) * (0.16 + 0.85 * Math.pow(max(0, nd), 12));
      }
      if (d < 0.5) {
        const cov = cl(0.5 - d, 0, 1);
        // Inside the liquid: the essence, brighter just under the surface and
        // deeper towards the bottom, slow shafts of light from the surface
        // swaying through it, and the deep colour where the drop has gone.
        const depth = cl(below / (H - Y0), 0, 1);
        let lv = below < 0 ? 0.88 + 0.09 * wm : 0.8 - 0.36 * depth + wm * (0.15 + 0.16 * depth);
        if (below >= 0) {
          const sx = x + 0.4 * below;
          lv += 0.16 * (1 - depth) * (0.5 + 0.5 * sin(0.3 * sx - 0.7 * T + 1.3 * sin(0.11 * sx + 0.23 * T)));
        }
        lv = min(1, lv);
        let lr = pal[3] * lv, lg = pal[4] * lv, lb = pal[5] * lv;
        const da = max(deep[i] * 0.9, 1 - exp(-dye[i] * 0.9));
        if (da > 0.003) {
          lr += (pal[6] * dv - lr) * da;
          lg += (pal[7] * dv - lg) * da;
          lb += (pal[8] * dv - lb) * da;
        }
        let rim = 0, inner = 0;
        if (!open) {
          // Everything but the open surface: the normal from the distance
          // field, a white highlight where it faces the light, a gloss on what
          // faces up, a darker rim on the far side and light gathered inside
          // the bottom of a bead.
          const xm = x > 0 ? sdf[i - 1] : d, xp = x < W - 1 ? sdf[i + 1] : d, ym = y > 0 ? sdf[i - W] : d, yp = y < H - 1 ? sdf[i + W] : d;
          let nx = xp - xm, ny = yp - ym;
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl;
          ny /= nl;
          const edge = cl(1 + d / 1.6, 0, 1), nd = nx * LX + ny * LY;
          spec += edge * (0.9 * Math.pow(max(0, nd), 7) + 0.22 * max(0, -ny));
          rim = edge * 0.35 * (1 - max(0, nd));
          inner = cl((-d - 0.6) / 1.2, 0, 1) * cl((3 + d) / 1.5, 0, 1) * Math.pow(max(0, -nd), 2) * (below < 1 ? 0.6 : 0);
        }
        lr = lr * (1 - rim) + inner * pal[3];
        lg = lg * (1 - rim) + inner * pal[4];
        lb = lb * (1 - rim) + inner * pal[5];
        r += (lr - r) * cov;
        g += (lg - g) * cov;
        b += (lb - b) * cov;
      }
      r += spec;
      g += spec;
      b += spec;
      display.setPixel(x, y, 255 * min(1, r), 255 * min(1, g), 255 * min(1, b));
    }
  }
}
