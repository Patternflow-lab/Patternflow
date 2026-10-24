// ===== Patternflow pattern =====
// Title:   Gold Leaf
// Family:  cosmetic
// Idea:    Crumpled flakes of gold foil hang in a clear tinted serum and drift round a slow convection current without ever settling, each torn flake tumbling so its crumple facets flash gold-white one after another as they face the light and drop to deep gold as they turn away, near flakes large and sharp, far ones small, dim and soft.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 33, after a serum with flakes of gold leaf floating in it
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Flakes=40..120, Size=0..1
//
// Knob 1: Hue. Turns the foil all the way round the wheel, and the serum's faint tint with it. At 0 the foil is yellow gold; at 0.07 green gold, at 0.5 blue foil in a blue-black serum, at 0.88 rose gold and at 0.93 copper. Round orange and yellow the shadowed facets stay bright and saturated, so the foil never goes brown.
// Knob 2: Speed. How fast the current carries the flakes and how fast they tumble. At 2 the near flakes drift up to 3 LEDs a second round two convection cells, one above the other, and a flake turns over every 4 to 12 seconds; at 0.2 all of it runs ten times slower.
// Knob 3: Flakes. How many flakes hang in the serum: 40 at the opening, about a third of them far back, small and soft; up to 120, a crowd of foil.
// Knob 4: Size. How big the flakes are: at the opening the nearest are about 12 LEDs across and the farthest about 5; at 1 about 23 and 10, and the facets read one by one.
// Buttons: K1 tap stirs the serum: within a second the flakes are swept into a slow vortex the shape of the panel, a turn every 5 to 10 seconds, tumbling up to five times faster and flashing all over; over the next eight seconds it dies away and the convection takes them back.

const W = 64, H = 128, N = W * H;
const MAXF = 120, SS = 3;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// The light: from the upper left and in front. Y runs down the panel, the
// viewer looks along -z.
const LX = -0.4, LY = -0.7, LZ = 0.6, LN = sqrt(LX * LX + LY * LY + LZ * LZ);
const L = [LX / LN, LY / LN, LZ / LN];
const HV = [L[0], L[1], L[2] + 1], HN = sqrt(HV[0] ** 2 + HV[1] ** 2 + HV[2] ** 2);
const HH = [HV[0] / HN, HV[1] / HN, HV[2] / HN];

// A torn flake: 6 to 9 points round a ragged outline, each pushed up or down
// a little, fanned from an off-centre middle point into facets. The heights
// are the crumple: every facet tilts its own way.
function makeFlake() {
  const rnd = Math.random, k = 6 + floor(rnd() * 4), e = 0.6 + 0.4 * rnd(), ea = rnd() * PI;
  const v = [(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3];
  for (let i = 0; i < k; i++) {
    const a = (2 * PI * (i + 0.7 * (rnd() - 0.5))) / k, r = 0.55 + 0.45 * rnd();
    const x = r * cos(a), y = r * sin(a) * e;
    v.push(x * cos(ea) - y * sin(ea), x * sin(ea) + y * cos(ea), (rnd() - 0.5) * 0.8);
  }
  const nrm = [];
  for (let i = 0; i < k; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % k);
    const ux = v[a * 3] - v[0], uy = v[a * 3 + 1] - v[1], uz = v[a * 3 + 2] - v[2];
    const wx = v[b * 3] - v[0], wy = v[b * 3 + 1] - v[1], wz = v[b * 3 + 2] - v[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = sqrt(nx * nx + ny * ny + nz * nz) || 1;
    if (nz < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    nrm.push(nx / l, ny / l, nz / l);
  }
  const ax = rnd() - 0.5, ay = rnd() - 0.5, az = rnd() - 0.5, al = sqrt(ax * ax + ay * ay + az * az) || 1;
  const q0 = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], ql = sqrt(q0.reduce((s, c) => s + c * c, 0)) || 1;
  return {
    k, v: new Float32Array(v), n: new Float32Array(nrm),
    x: 3 + rnd() * (W - 6), y: 3 + rnd() * (H - 6), z: rnd(), sz: 0.75 + 0.5 * rnd(),
    q: q0.map((c) => c / ql), axis: [ax / al, ay / al, az / al], spin: (0.5 + rnd()) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 2 * PI,
  };
}

export function setup(params) {
  const flakes = [];
  for (let i = 0; i < MAXF; i++) flakes.push(makeFlake());
  params.s = {
    flakes, t: 0, stir: 0, stirT: -1, hue: 0, count: 40, size: 0.06,
    far: new Float32Array(N * 4), tmp: new Float32Array(N * 4), frame: new Float32Array(N * 3),
    sub: new Int16Array(64 * 64 * SS * SS), lut: new Float32Array(256 * 3), lutHue: NaN, serum: [],
  };
}

// The current: two slow convection cells stacked in the panel, from the
// stream function sin(pi x/W) sin(2 pi y/H), which is zero on all four walls,
// so the flakes go round and never leave. A weaker mode of smaller cells
// swells and fades over a minute, so no flake runs the same loop twice.
// Nothing pulls them down: the flakes float, they never settle.
function flow(x, y, t, out) {
  const X = (PI * x) / W, Y = (2 * PI * y) / H, s = 0.35 * sin(t * 0.11);
  out[0] = sin(X) * cos(Y) + s * sin(2 * X) * 1.5 * cos(1.5 * Y) * 0.5;
  out[1] = -cos(X) * sin(Y) - s * 2 * cos(2 * X) * sin(1.5 * Y) * 0.5;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 40, 0.06], d = cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  P.hue = k[0];
  P.count = floor(cl(k[2], 40, 120));
  P.size = cl(k[3], 0, 1);
  P.t += d;
  if (input.btnPressed && input.btnPressed[0]) P.stirT = 0;
  // The stir: a second to wind up, then it dies away over about eight.
  if (P.stirT >= 0) {
    P.stirT += d;
    P.stir = P.stirT < 1 ? sm(0, 1, P.stirT) : exp(-(P.stirT - 1) / 3.5);
    if (P.stirT > 20) (P.stirT = -1), (P.stir = 0);
  }
  const v = [0, 0], S = P.stir;
  for (let i = 0; i < MAXF; i++) {
    const f = P.flakes[i];
    flow(f.x, f.y, P.t, v);
    // Near flakes move faster across the panel than far ones.
    const par = 0.6 + 0.6 * f.z, sp = 2.6 * par;
    let vx = v[0] * sp + 0.4 * sin(P.t * 0.5 + f.ph), vy = v[1] * sp + 0.4 * cos(P.t * 0.37 + f.ph * 1.3);
    if (S > 0) {
      // The vortex runs round ellipses the shape of the panel, fastest
      // half way out, so the flakes swing round without piling on a wall.
      const ex = (f.x - W / 2) / (W / 2), ey = (f.y - H / 2) / (H / 2), r = sqrt(ex * ex + ey * ey);
      const g = S * 1.6 * cl(1.15 - r, 0, 1) * par;
      vx += g * -0.5 * (f.y - H / 2);
      vy += g * 2 * (f.x - W / 2);
    }
    f.x = cl(f.x + vx * d, 1, W - 2);
    f.y = cl(f.y + vy * d, 1, H - 2);
    // Tumble: turn about the flake's own axis, which wanders slowly.
    const ang = f.spin * (1 + 4 * S) * d, a = f.axis;
    a[0] += 0.3 * sin(P.t * 0.23 + f.ph) * d;
    a[1] += 0.3 * cos(P.t * 0.19 + f.ph * 2) * d;
    const al = sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    a[0] /= al;
    a[1] /= al;
    a[2] /= al;
    const sh = sin(ang / 2), ch = cos(ang / 2), dq = [ch, a[0] * sh, a[1] * sh, a[2] * sh], q = f.q;
    const n0 = dq[0] * q[0] - dq[1] * q[1] - dq[2] * q[2] - dq[3] * q[3];
    const n1 = dq[0] * q[1] + dq[1] * q[0] + dq[2] * q[3] - dq[3] * q[2];
    const n2 = dq[0] * q[2] - dq[1] * q[3] + dq[2] * q[0] + dq[3] * q[1];
    const n3 = dq[0] * q[3] + dq[1] * q[2] - dq[2] * q[1] + dq[3] * q[0];
    const ql = sqrt(n0 * n0 + n1 * n1 + n2 * n2 + n3 * n3);
    q[0] = n0 / ql;
    q[1] = n1 / ql;
    q[2] = n2 / ql;
    q[3] = n3 / ql;
  }
}

// The foil's colour against its light, 0 to 1.3 over 256 steps: deep, gold,
// pale gold, white-gold.
function buildLut(P) {
  const h = P.hue + 0.115 - floor(P.hue + 0.115);
  // Round orange and yellow the deep end stays bright and saturated so it
  // reads as dark gold, not brown; round red and pink the foil is paler, rose
  // gold rather than red.
  const warm = sm(0.0, 0.05, h) * (1 - sm(0.17, 0.24, h)), rose = 1 - sm(0.02, 0.07, abs(h - 0.995 + (h < 0.5 ? 1 : 0)));
  const sat = 1 - 0.4 * rose, lift = max(warm, rose);
  const stops = [
    [0, hsv(h - 0.025, 0.95 * sat, 0.4 + 0.18 * lift)],
    [0.35, hsv(h - 0.01, 0.88 * sat, 0.72 + 0.12 * lift)],
    [0.7, hsv(h + 0.005, 0.68 * sat, 1)],
    [1.0, hsv(h + 0.01, 0.34 * sat, 1)],
    [1.3, hsv(h + 0.01, 0.06, 1)],
  ];
  for (let i = 0; i < 256; i++) {
    const b = (i / 255) * 1.3;
    let j = 0;
    while (j < stops.length - 2 && b > stops[j + 1][0]) j++;
    const [b0, c0] = stops[j], [b1, c1] = stops[j + 1], f = cl((b - b0) / (b1 - b0), 0, 1);
    for (let c = 0; c < 3; c++) P.lut[i * 3 + c] = (c0[c] + (c1[c] - c0[c]) * f) * 255;
  }
  // The serum: the foil's hue, faint and greyed, lighter at the top.
  const top = hsv(h - 0.02, (0.5 - 0.2 * warm) * sat, 0.11), bot = hsv(h - 0.02, (0.6 - 0.2 * warm) * sat, 0.025);
  const lit = hsv(h + 0.01, 0.3 * sat, 1);
  P.serum = [top[0] * 255, top[1] * 255, top[2] * 255, bot[0] * 255, bot[1] * 255, bot[2] * 255, lit[0] * 255, lit[1] * 255, lit[2] * 255];
  P.lutHue = P.hue;
}

const rot = new Float32Array(9);
function quatMat(q) {
  const [w, x, y, z] = q;
  rot[0] = 1 - 2 * (y * y + z * z); rot[1] = 2 * (x * y - w * z); rot[2] = 2 * (x * z + w * y);
  rot[3] = 2 * (x * y + w * z); rot[4] = 1 - 2 * (x * x + z * z); rot[5] = 2 * (y * z - w * x);
  rot[6] = 2 * (x * z - w * y); rot[7] = 2 * (y * z + w * x); rot[8] = 1 - 2 * (x * x + y * y);
}

const PX = new Float32Array(10 * 3), FC = new Float32Array(9 * 4), ORD = [];

// One flake into buffer buf (RGB, or RGBA premultiplied when far), over what
// is there. Each LED takes 3 x 3 samples, 2 x 2 on a big flake; a facet
// nearer the viewer covers the ones behind it, and the share of samples a
// flake covers is how much of the LED it takes.
function drawFlake(P, f, buf, rgba, dim, glints) {
  quatMat(f.q);
  const s = (6.5 + 6 * P.size) * f.sz * (0.5 + 0.7 * f.z), k = f.k, v = f.v, n = f.n, lut = P.lut;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let i = 0; i <= k; i++) {
    const a = v[i * 3], b = v[i * 3 + 1], c = v[i * 3 + 2];
    const X = f.x + s * (rot[0] * a + rot[1] * b + rot[2] * c), Y = f.y + s * (rot[3] * a + rot[4] * b + rot[5] * c);
    PX[i * 3] = X;
    PX[i * 3 + 1] = Y;
    PX[i * 3 + 2] = rot[6] * a + rot[7] * b + rot[8] * c;
    x0 = min(x0, X);
    x1 = max(x1, X);
    y0 = min(y0, Y);
    y1 = max(y1, Y);
  }
  // Big flakes need fewer samples to an LED for the same smooth edge.
  const ss = s > 7 ? 2 : SS;
  const bx = max(0, floor(x0)), by = max(0, floor(y0)), bw = min(W, floor(x1) + 1) - bx, bh = min(H, floor(y1) + 1) - by;
  if (bw <= 0 || bh <= 0 || bw > 64 || bh > 64) return;
  const sw = bw * ss, sub = P.sub;
  sub.fill(-1, 0, sw * bh * ss);
  ORD.length = 0;
  for (let i = 0; i < k; i++) {
    // The facet's normal turned with the flake, towards the viewer: foil
    // shines from both faces.
    const a = n[i * 3], b = n[i * 3 + 1], c = n[i * 3 + 2];
    let nx = rot[0] * a + rot[1] * b + rot[2] * c, ny = rot[3] * a + rot[4] * b + rot[5] * c, nz = rot[6] * a + rot[7] * b + rot[8] * c;
    if (nz < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    const spec = max(0, nx * HH[0] + ny * HH[1] + nz * HH[2]) ** 18, diff = max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    // A little base light, the lamp's diffuse share, the glow of the serum
    // above for facets tipped up, and a narrow highlight, cos^18, half
    // strength 16 degrees off the mirror angle: a facet flashes as it
    // sweeps through and its neighbours, tilted their own ways, stay deep.
    const env = 0.5 - 0.5 * ny;
    const br = (0.1 + 0.45 * diff + 0.25 * env + 0.95 * spec) * dim;
    FC[i * 4] = cl(floor((br / 1.3) * 255), 0, 255);
    FC[i * 4 + 1] = spec;
    const j1 = 1 + i, j2 = 1 + ((i + 1) % k);
    FC[i * 4 + 2] = (PX[2] + PX[j1 * 3 + 2] + PX[j2 * 3 + 2]) / 3;
    ORD.push(i);
  }
  ORD.sort((a, b) => FC[a * 4 + 2] - FC[b * 4 + 2]);
  for (const i of ORD) {
    const j1 = 1 + i, j2 = 1 + ((i + 1) % k);
    const ax = PX[0], ay = PX[1], bxx = PX[j1 * 3], byy = PX[j1 * 3 + 1], cx = PX[j2 * 3], cy = PX[j2 * 3 + 1];
    const area = (bxx - ax) * (cy - ay) - (byy - ay) * (cx - ax);
    if (abs(area) < 1e-4) continue;
    const sg = area > 0 ? 1 : -1;
    const sx0 = max(0, floor((min(ax, bxx, cx) - bx) * ss)), sx1 = min(sw - 1, floor((max(ax, bxx, cx) - bx) * ss));
    const sy0 = max(0, floor((min(ay, byy, cy) - by) * ss)), sy1 = min(bh * ss - 1, floor((max(ay, byy, cy) - by) * ss));
    for (let sy = sy0; sy <= sy1; sy++) {
      const py = by + (sy + 0.5) / ss;
      for (let sx = sx0; sx <= sx1; sx++) {
        const px = bx + (sx + 0.5) / ss;
        const e0 = ((bxx - ax) * (py - ay) - (byy - ay) * (px - ax)) * sg;
        const e1 = ((cx - bxx) * (py - byy) - (cy - byy) * (px - bxx)) * sg;
        const e2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * sg;
        if (e0 >= 0 && e1 >= 0 && e2 >= 0) sub[sy * sw + sx] = i;
      }
    }
    if (glints && FC[i * 4 + 1] > 0.6) glints.push((ax + bxx + cx) / 3, (ay + byy + cy) / 3, FC[i * 4 + 1]);
  }
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      let r = 0, g = 0, b = 0, c = 0;
      for (let u = 0; u < ss; u++)
        for (let w = 0; w < ss; w++) {
          const i = sub[(y * ss + u) * sw + x * ss + w];
          if (i < 0) continue;
          const li = FC[i * 4] * 3;
          r += lut[li];
          g += lut[li + 1];
          b += lut[li + 2];
          c++;
        }
      if (!c) continue;
      const al = c / (ss * ss), p = (by + y) * W + bx + x;
      if (rgba) {
        const o = p * 4;
        buf[o] = buf[o] * (1 - al) + r / (ss * ss);
        buf[o + 1] = buf[o + 1] * (1 - al) + g / (ss * ss);
        buf[o + 2] = buf[o + 2] * (1 - al) + b / (ss * ss);
        buf[o + 3] = buf[o + 3] * (1 - al) + al;
      } else {
        const o = p * 3;
        buf[o] = buf[o] * (1 - al) + r / (ss * ss);
        buf[o + 1] = buf[o + 1] * (1 - al) + g / (ss * ss);
        buf[o + 2] = buf[o + 2] * (1 - al) + b / (ss * ss);
      }
    }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  if (P.lutHue !== P.hue) buildLut(P);
  const fr = P.frame, far = P.far, tmp = P.tmp, t = P.t, sv = P.serum;
  // The serum: a soft gradient and a slow caustic shimmer that fades with
  // depth, light let in from the top.
  const colw = P.colw || (P.colw = new Float32Array(W));
  for (let x = 0; x < W; x++) colw[x] = 1.5 * sin(x * 0.17 - t * 0.31);
  for (let y = 0; y < H; y++) {
    const g = y / (H - 1), dep = exp(-y / 70), roww = 1.7 * sin(y * 0.11 + t * 0.4) + t * 0.23;
    for (let x = 0; x < W; x++) {
      const a = sin(x * 0.19 + roww), b = sin(y * 0.13 + colw[x] - t * 0.17);
      const c = a + b, caus = exp(-c * c * 6) * 0.9 * dep, o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) fr[o + ch] = sv[ch] * (1 - g) + sv[3 + ch] * g + caus * 0.07 * sv[6 + ch];
    }
  }
  const fl = P.flakes.slice(0, P.count).sort((a, b) => a.z - b.z);
  far.fill(0);
  let i = 0;
  // Far flakes, dimmer, into their own layer, softened by a 1-2-1 blur.
  for (; i < fl.length && fl[i].z < 0.35; i++) drawFlake(P, fl[i], far, true, 0.6 + 0.6 * fl[i].z, null);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, l = x > 0 ? o - 4 : o, r = x < W - 1 ? o + 4 : o;
      for (let c = 0; c < 4; c++) tmp[o + c] = (far[l + c] + 2 * far[o + c] + far[r + c]) / 4;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, u = y > 0 ? o - W * 4 : o, dn = y < H - 1 ? o + W * 4 : o, f3 = (y * W + x) * 3;
      const a = (tmp[u + 3] + 2 * tmp[o + 3] + tmp[dn + 3]) / 4;
      for (let c = 0; c < 3; c++) fr[f3 + c] = fr[f3 + c] * (1 - a) + (tmp[u + c] + 2 * tmp[o + c] + tmp[dn + c]) / 4;
    }
  // Near flakes, sharp, over the top; their brightest facets throw a glint.
  const glints = [];
  for (; i < fl.length; i++) drawFlake(P, fl[i], fr, false, 1, fl[i].z > 0.6 ? glints : null);
  for (let g = 0; g < glints.length; g += 3) {
    const gx = floor(glints[g]), gy = floor(glints[g + 1]), s = (glints[g + 2] - 0.6) / 0.4;
    for (let r = -2; r <= 2; r++) {
      const a = s * (r === 0 ? 1 : abs(r) === 1 ? 0.55 : 0.22);
      for (const [x, y] of r === 0 ? [[gx, gy]] : [[gx + r, gy], [gx, gy + r]]) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = (y * W + x) * 3;
        fr[o] += 255 * a;
        fr[o + 1] += 250 * a;
        fr[o + 2] += 225 * a;
      }
    }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, fr[o]), min(255, fr[o + 1]), min(255, fr[o + 2]));
}
