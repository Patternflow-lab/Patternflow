// ===== Patternflow pattern =====
// Title:   Jack-in-the-Box
// Family:  halloween
// Idea:    A purple tin box with orange harlequin diamonds sits on the floor while its crank turns by itself and the box shivers at every turn, until the lid bursts open and a grinning jack-o'-lantern on a long coiled spring shoots up the panel, overshoots and bobs on the stretching and bunching coil, swaying side to side, then slowly sinks back in, the lid slams and the crank turns again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spring=0..1, Wobble=0..1
//
// Knob 1: Hue. The tin and the candle in the head. The tin runs from purple at 0 through blue and teal to poison green at 1, its diamonds always orange; the candle from orange at 0 through lime at 0.25, sea green at 0.5 and blue at 0.75 to violet at 1, lighting the carving, the glow round the head and the inside of the box. The pumpkin's skin and the spring stay as they are.
// Knob 2: Speed. At 2 the lid bursts at 0.85 seconds, the head bobs for 3.6 seconds, sinks back in 1.6, the lid slams and the crank turns for 1.4 seconds before the next pop, so a pop comes every 7 seconds; the crank turns 1.3 times a second. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Spring. Its stiffness. At 0 a soft spring: the head rests 40 LEDs above the box, overshoots to 66 and bounces deep and slow, 0.9 bounces a second; at 1 a stiff one: the head rides 56 LEDs up and buzzes 4.5 times a second in a tight shiver that dies away.
// Knob 4: Wobble. How far the spring and the head sway. The pop throws the head to one side and it swings back and forth every 2.4 seconds, the head tilting with the top of the spring and rocking on its neck: at 0 about 2 LEDs either way, at the opening 0.06 about 3, at 1 a throw of 20 LEDs that settles to 12 either way.
// Buttons: K1 tap pops it now; with the head already out it gives the head another shove up.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sqrt, sin, cos, atan2, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The box in an oblique view: the front face from column 10 to 46 and row
// 93 to 121, and one unit of depth going 0.4 right and 0.22 up, so the top
// and the right side show. The box is 24 deep.
const X0 = 10, X1 = 46, Y0 = 93, Y1 = 121, DEP = 24, DX = 0.4 * DEP, DY = 0.22 * DEP, FLOOR = 122;
// The spring stands on the middle of the top; L is how far it reaches up
// from there to the bottom of the head's collar. Shut in, the head sits at
// L = -27, its stem below the box's front edge.
const BX = (X0 + X1) / 2 + DX / 2, BY = Y0 - DY / 2, INSIDE = -27, LMAX = 68;
// The head: a pumpkin RX by RY, the collar under it, and the coil.
const RX = 12, RY = 10, NECK = 2.5, COILS = 8, CR = 5.5;
// The story at Speed 2, in seconds after a pop: bob, sink, slam; then the
// box stays shut and cranks for SHUT before the next pop. The first pop
// comes at FIRST.
const BOB = 3.6, SINK = 1.6, SLAM = 0.35, SHUT = 1.4, FIRST = 0.85, CYCLE = BOB + SINK + SLAM + SHUT;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, stiff: 0, wob: 0.06,
    // Spring length and speed; time since the pop (negative while shut);
    // the lid's angle and speed; the crank's angle, the jolt it gives the
    // box and the trembling before a pop; which side the pop throws the
    // head; the candle's flicker.
    L: INSIDE, v: 0, since: -FIRST, lid: 0, lidV: 0, crank: 0, jolt: 0, tremble: 0, side: 1, flick: 1,
    buf: new Float32Array(N * 3), key: "", pal: null,
  };
}

// Where the spring wants to rest and how it moves, by stiffness s: the
// angular frequency, the rest length and the damping, light for small
// motions and heavy for fast ones, so the pop cannot fly off the panel.
function springOf(s) {
  return { w: TAU * 0.9 * 5 ** s, le: 40 + 16 * s, z: 0.05 - 0.04 * s, c2: 0.012 + 0.02 * s };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.stiff = cl(k[2], 0, 1);
  S.wob = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  // A tap: pop now if shut or on the way down, or shove the head up.
  if (input.btnPressed && input.btnPressed[0]) {
    if (S.since < 0 || S.since > BOB) pop(S);
    else S.v += 160;
  }
  // The clock of one cycle: negative while the box waits for its first pop,
  // 0 at a pop, and round again to the next pop at CYCLE.
  const before = S.since;
  S.since += ds;
  if ((before < 0 && S.since >= 0) || S.since >= CYCLE) pop(S);
  const sp = springOf(S.stiff), a = S.since;
  // The rest length: up while it bobs, drawn down into the box as it sinks.
  const out = a >= 0 && a < BOB + SINK;
  const le = a < 0 ? INSIDE : a < BOB ? sp.le : a < BOB + SINK ? sp.le + (INSIDE - 2 - sp.le) * ease((a - BOB) / SINK) : INSIDE;
  // The spring, in eight steps a frame: L'' = -w^2 (L - le) - 2 z w L' - c2 |L'| L'.
  if (out || S.L > INSIDE + 0.5 || abs(S.v) > 1) {
    const n = 8, h = ds / n;
    for (let i = 0; i < n; i++) {
      let acc = -sp.w * sp.w * (S.L - le) - 2 * sp.z * sp.w * S.v - sp.c2 * abs(S.v) * S.v;
      // The coil cannot stretch past LMAX: it pulls back hard there.
      if (S.L > LMAX) acc -= 900 * (S.L - LMAX) + 25 * max(0, S.v);
      S.v += acc * h;
      S.L += S.v * h;
    }
    // Shut in the box, it stops at the bottom.
    if (!out && S.L < INSIDE) (S.L = INSIDE), (S.v = 0);
    // Going down it stops on the bottom of the box.
    if (S.L < INSIDE - 2) (S.L = INSIDE - 2), (S.v = max(0, S.v));
  }
  // The lid: flung open at the pop to lean back past upright, then shut as
  // the head goes down, with a small bounce each time.
  const goal = a >= 0 && a < BOB + SINK ? 1.95 : 0;
  const lk = goal ? 260 : 380, lz = goal ? 16 : 14;
  S.lidV += (-lk * (S.lid - goal) - lz * S.lidV) * ds;
  if (a >= BOB + SINK - 0.05 && S.L > INSIDE + 6) S.lidV = max(S.lidV, 0);
  S.lid += S.lidV * ds;
  if (S.lid < 0) (S.lid = 0), (S.lidV = -0.35 * S.lidV);
  // While shut the crank turns 1.3 times a second and jolts the box at every
  // turn; in the last 0.4 seconds before a pop the box trembles and the lid
  // rattles.
  const shut = a < 0 || a >= BOB + SINK + SLAM;
  if (shut) {
    const c0 = S.crank;
    S.crank += TAU * 1.3 * ds;
    if (floor(S.crank / TAU) !== floor(c0 / TAU)) S.jolt = 1;
  }
  S.jolt = max(0, S.jolt - ds / 0.09);
  const toPop = a < 0 ? -a : a >= BOB + SINK + SLAM ? CYCLE - a : 9;
  S.tremble = toPop < 0.4 ? 1 - toPop / 0.4 : 0;
  S.flick += (0.8 + 0.2 * Math.random() - S.flick) * min(1, ds * 12);
}

function pop(S) {
  S.since = 0;
  S.L = max(S.L, INSIDE);
  S.v = max(S.v, 0);
  S.side = Math.random() < 0.5 ? -1 : 1;
  S.lidV = max(S.lidV, 14);
}

// Colours that only change with Hue.
function palette(S) {
  const key = S.hue.toFixed(3);
  if (S.key === key) return;
  S.key = key;
  // The tin runs from purple through blue and teal to poison green; the
  // diamonds stay orange. The candle in the head runs from orange through
  // yellow and green to blue and violet.
  const h = 0.78 - 0.45 * S.hue, hd = 0.075, hc = 0.09 + 0.66 * S.hue;
  S.pal = {
    front: hsv(h, 0.78, 0.58), side: hsv(h, 0.8, 0.36), top: hsv(h, 0.7, 0.72), lining: hsv(h, 0.75, 0.22), inner: hsv(h, 0.8, 0.07),
    dia: hsv(hd, 0.92, 1), diaSide: hsv(hd - 0.01, 0.9, 0.8), diaTop: hsv(hd, 0.85, 0.9), floor: hsv(h, 0.6, 0.12),
    halo: hsv(hc, 0.92, 1), cut: hsv(hc, 0.85, 1), core: hsv(hc + 0.03, 0.55, 1),
  };
}

// The head's place and tilt from the spring: the coil leaves the box
// straight up and bends toward the head, a quadratic curve from its foot at
// (BX, BY) through (BX, BY - 0.55 L) to the collar.
function headOf(S) {
  // The pop throws the head to one side; it swings back and forth every
  // 2.4 seconds, wide at first and settling to a steady sway.
  const a = max(0, S.since), L = S.L, amp = 0.1 + 0.9 * S.wob, reach = cl(L / 40, 0, 1);
  const X = cl(amp * reach * S.side * (12 + 12 * exp(-a / 2.5)) * sin(TAU * 0.42 * a + 0.36), -20, 20);
  // The head tilts with the spring's end and rocks on its neck besides.
  const hx = BX + X, hy = BY - L, tilt = 0.85 * atan2(X, max(8, 0.45 * L)) + amp * reach * 0.3 * sin(TAU * 0.9 * a);
  return { hx, hy, tilt, cx: hx + (RY + NECK) * sin(tilt), cy: hy - (RY + NECK) * cos(tilt) };
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const P = S.pal, buf = S.buf;
  // The box's jolt and trembling, in whole LEDs.
  const jy = S.jolt > 0.5 ? -1 : 0, jx = S.tremble > 0 && floor(S.t * 30) % 2 ? (S.tremble > 0.5 ? 1 : 0) : 0;
  const ox = X0 + jx, oy = Y0 + jy;
  const head = headOf(S), glow = cl((S.L - INSIDE) / 20, 0, 1) * S.flick;
  const set = (p, c, a) => {
    const o = 3 * p;
    buf[o] = c[0] * a;
    buf[o + 1] = c[1] * a;
    buf[o + 2] = c[2] * a;
  };
  // Night: black above, a floor in the tin's colour, the candle's glow
  // around the head.
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = 3 * p;
      let r = 0, g = 0, b = 0;
      if (y >= FLOOR) {
        const f = 0.8 + 0.2 * ((y - FLOOR) / (H - FLOOR));
        (r = P.floor[0] * f), (g = P.floor[1] * f), (b = P.floor[2] * f);
      }
      const dx = x + 0.5 - head.cx, dy = (y + 0.5 - head.cy) * 0.85, d2 = dx * dx + dy * dy;
      if (d2 < 900 && glow > 0) {
        const q = (1 - sqrt(d2) / 30) ** 2 * 0.42 * glow;
        r += q * P.halo[0];
        g += q * P.halo[1];
        b += q * P.halo[2];
      }
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  // The lid on its hinge along the back edge of the top: lid angle 0 lies
  // shut, past 0.22 radians it shows its lining. Open wide it stands behind
  // the spring; nearly shut it lies over everything.
  const lidQuad = () => {
    const ph = S.lid + 0.1 * S.tremble * abs(sin(S.t * 47)), fx = -DX * cos(ph), fy = DY * cos(ph) - DEP * sin(ph), hx0 = ox + DX, hy = oy - DY;
    const y0 = floor(min(hy, hy + fy)), y1 = floor(max(hy, hy + fy)), outer = fy > 0;
    for (let y = max(0, y0); y <= min(H - 1, y1 + 1); y++) {
      const t = fy === 0 ? 0 : cl((y + 0.5 - hy) / fy, 0, 1);
      if (abs(fy) > 0.5 && ((y + 0.5 - hy) / fy < -0.02 || (y + 0.5 - hy) / fy > 1.02)) continue;
      const xa = hx0 + fx * t;
      for (let x = max(0, floor(xa)); x < min(W, xa + (X1 - X0)); x++) {
        const u = x + 0.5 - xa, side = u < 1 || u > X1 - X0 - 1, rim = side || t > 0.85 || t < 0.12;
        let c = outer ? (rim ? [0.95, 0.75, 0.3] : P.top) : side || t > 0.9 ? [0.62, 0.46, 0.18] : P.lining;
        if (outer && !rim && diamond(u - 7, (1 - t) * DEP - 6)) c = P.diaTop;
        // The lining darkens toward the free edge and takes the head's glow.
        set(y * W + x, c, outer || side || t > 0.9 ? 1 : 1.25 - 0.55 * t + 0.6 * glow * (1 - t));
      }
    }
  };
  if (S.lid > 0.9) lidQuad();
  // The top: the open mouth of the box, dark, lit orange by the head inside.
  for (let y = floor(oy - DY); y < oy; y++) {
    const t = (oy - (y + 0.5)) / DY, xa = ox + DX * t;
    for (let x = floor(xa); x < xa + (X1 - X0); x++) {
      if (x < 0 || x >= W) continue;
      const c = P.inner, a = 1 + 4 * glow * (1 - t);
      set(y * W + x, [c[0] * a + 0.25 * glow * P.halo[0], c[1] * a + 0.25 * glow * P.halo[1], c[2] * a + 0.25 * glow * P.halo[2]], 1);
    }
  }
  // The spring: a helix about the curve, back half first, steel bright in front.
  const L = S.L, hx = head.hx, hy = head.hy, bx = BX + jx, by = BY + jy;
  if (L > -2) {
    const steps = COILS * 40;
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i <= steps; i++) {
        const s = i / steps, ph = TAU * COILS * s + 0.6, z = sin(ph);
        if ((z > 0) !== (pass === 1)) continue;
        // Bezier point and tangent.
        const m1x = bx, m1y = by - 0.55 * L, u = 1 - s;
        const px = u * u * bx + 2 * u * s * m1x + s * s * hx, py = u * u * by + 2 * u * s * m1y + s * s * hy;
        let tx = 2 * u * (m1x - bx) + 2 * s * (hx - m1x), ty = 2 * u * (m1y - by) + 2 * s * (hy - m1y);
        const tl = sqrt(tx * tx + ty * ty) || 1;
        (tx /= tl), (ty /= tl);
        const r = CR * (s < 0.04 ? 0.6 + 10 * s : 1), x = floor(px - ty * r * cos(ph) + 0.5), y = floor(py + tx * r * cos(ph) + 0.5);
        if (x < 0 || x >= W || y < 0 || y >= oy + Y1 - Y0) continue;
        const lit = pass ? 0.55 + 0.45 * z : 0.22 + 0.1 * (1 + z), shine = pass && z > 0.85 ? 0.25 : 0;
        set(y * W + x, [0.78 * lit + shine + 0.15 * glow * lit, 0.8 * lit + shine + 0.05 * glow * lit, 0.9 * lit + shine], 1);
      }
  }
  // The head: a ribbed pumpkin with a carved grin glowing from inside, a
  // green collar of points under it and a stem on top, all tilted with the
  // spring's end.
  {
    const ct = cos(head.tilt), st = sin(head.tilt), cx = head.cx, cy = head.cy, fl = S.flick;
    for (let y = max(0, floor(cy - 15)); y < min(oy + Y1 - Y0, cy + 16); y++)
      for (let x = max(0, floor(cx - 15)); x < min(W, cx + 16); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ct + dy * st, v = -dx * st + dy * ct;
        const p = y * W + x;
        // The collar: a ring of points below the head.
        if (v > RY - 2 && v < RY + NECK + 2.2 && abs(u) < 9) {
          const tip = RY + NECK + 2.2 - 2.2 * abs(sin((u * PI) / 3));
          if (v < tip) {
            set(p, (floor((u + 9) / 3) & 1) ? [0.35, 1, 0.1] : [0.6, 0.15, 0.85], 0.9);
            continue;
          }
        }
        // The stem.
        if (v < -RY + 1.5 && v > -RY - 3.2 && abs(u - 0.4 - 0.35 * (v + RY)) < 1.4) {
          set(p, [0.25, 0.55, 0.12], 1);
          continue;
        }
        // The pumpkin: an ellipse with lobes.
        const ang = atan2(v, u), e = (u / RX) ** 2 + (v / RY) ** 2, lobe = 1 - 0.05 * abs(sin(ang * 3));
        if (e > lobe * lobe) continue;
        const face = carved(u, v);
        // The cut wall shows as a dark line along the top of each hole.
        if (!face && carved(u, v + 1)) {
          set(p, [0.5, 0.17, 0.02], 1);
          continue;
        }
        if (face) {
          // The candle inside: pale at the core, its full colour at the cut.
          set(p, face === 2 ? P.cut : P.core, face === 2 ? 0.8 * fl : fl);
          continue;
        }
        // Skin: ribs along the meridians, lit from the upper left, a darker
        // rind at the edge so the head stands off its own glow.
        const mer = u / RX / sqrt(max(0.05, 1 - (v / RY) ** 2)), rib = abs(sin(mer * PI * 2.2)) < 0.22 ? 0.84 : 1;
        const light = (0.82 + 0.18 * cl(-(u + v) / RX, -1, 1)) * (e > 0.8 * lobe * lobe ? 0.78 : 1);
        set(p, [light * rib, 0.44 * light * rib, 0.04], 1);
      }
  }
  // The box's front and right side, over whatever is inside it.
  for (let y = max(0, floor(oy - DY)); y <= oy + (Y1 - Y0); y++)
    for (let x = ox; x < min(W, ox + (X1 - X0) + DX + 1); x++) {
      const p = y * W + x, u = x + 0.5 - ox, v = y + 0.5 - oy;
      if (u < X1 - X0) {
        if (v < 0 || v > Y1 - Y0) continue;
        // Gold rims top and bottom, purple tin with orange diamonds between.
        if (v < 2 || v > Y1 - Y0 - 2) {
          set(p, [0.95, 0.72, 0.25], v < 1 || v > Y1 - Y0 - 1 ? 1 : 0.75);
          continue;
        }
        // Diamonds on a harlequin lattice, three across and two down, each
        // 10 LEDs from point to point, the purple showing between.
        const di = diamond(u - 7, v - 2);
        const edge = u < 1 ? 1.3 : u > X1 - X0 - 1 ? 0.75 : 1;
        set(p, di ? P.dia : P.front, edge);
      } else {
        const t = (u - (X1 - X0)) / DX;
        if (t > 1) continue;
        const vv = v + DY * t;
        if (vv < 0 || vv > Y1 - Y0) continue;
        if (vv < 2 || vv > Y1 - Y0 - 2) {
          set(p, [0.6, 0.45, 0.15], 1);
          continue;
        }
        set(p, diamond(t * DEP - 6, vv - 2) ? P.diaSide : P.side, 1);
      }
    }
  // The crank on the side: a brass hub, an arm turning in the side's plane
  // and a red knob sticking out of it.
  {
    const hubX = ox + (X1 - X0) + DX / 2 + 1, hubY = oy + (Y1 - Y0) / 2 - DY / 2, c = S.crank;
    const ex = hubX + 1.5 + 7 * cos(c) * 0.4, ey = hubY - 7 * cos(c) * 0.22 + 7 * sin(c);
    const dot = (x, y, col, a = 1) => {
      x = floor(x);
      y = floor(y);
      if (x >= 0 && x < W && y >= 0 && y < H) set(y * W + x, col, a);
    };
    for (let i = 0; i <= 10; i++) dot(hubX + (1.5 * i) / 10 + ((ex - hubX - 1.5) * i) / 10, hubY + ((ey - hubY) * i) / 10, [0.95, 0.75, 0.3]);
    dot(hubX, hubY, [1, 0.9, 0.55]);
    dot(hubX + 1, hubY, [0.9, 0.7, 0.3]);
    for (let i = 1; i <= 3; i++) dot(ex + i, ey, [0.8, 0.6, 0.25]);
    for (const [kx, ky] of [[4, 0], [5, 0], [4, -1], [5, -1], [6, 0], [4, 1], [5, 1]]) dot(ex + kx, ey + ky, [1, 0.25, 0.12], kx === 6 ? 0.8 : 1);
  }
  if (S.lid <= 0.9) lidQuad();
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) display.setPixel(x, y, round(min(1, buf[3 * p]) * 255), round(min(1, buf[3 * p + 1]) * 255), round(min(1, buf[3 * p + 2]) * 255));
}

// Whether (a, b), in LEDs along and across a face of the tin, falls in one
// of its diamonds: every other cell of a lattice of 12 by 12 diamonds holds
// one, 10 from point to point, centred on a = 0 and b = 6.
function diamond(a, b) {
  const qa = a / 12 + b / 12, qb = a / 12 - b / 12, fa = qa - floor(qa), fb = qb - floor(qb);
  return (floor(qa) + floor(qb)) & 1 && max(abs(fa - 0.5), abs(fb - 0.5)) < 0.42;
}

// The carving at (u, v) in the head's frame: 0 skin, 1 the open cut, 2 its
// lit rim. Two eyes pointing up, a small nose and a wide grin curving up at
// the corners, with a tooth hanging from the top and one standing below.
function carved(u, v) {
  const au = abs(u);
  // Eyes: triangles 7 wide at v = -0.5 up to a point at v = -6, centred at |u| = 5.
  if (v < -0.5 && v > -6) {
    const half = (3.5 * (v + 6)) / 5.5, e = abs(au - 5);
    if (e < half) return v > -1.5 || e > half - 1 ? 2 : 1;
  }
  // Nose: a small triangle.
  if (v > 0.3 && v < 2.6 && au < (v - 0.3) * 0.8 + 0.2) return 2;
  // Grin: between two curves meeting at |u| = 9.5, v = 3.2.
  const q = 1 - (au / 9.5) ** 2;
  if (q > 0) {
    const top = 3.2 + 1.3 * q, bot = 3.2 + 4.6 * q;
    if (v > top && v < bot) {
      if ((abs(u + 2.6) < 1.2 && v < top + 1.6) || (abs(u - 3) < 1.2 && v > bot - 1.6)) return 0;
      return v > bot - 1 ? 2 : 1;
    }
  }
  return 0;
}
