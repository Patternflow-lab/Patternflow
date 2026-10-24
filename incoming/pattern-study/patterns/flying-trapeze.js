// ===== Patternflow pattern =====
// Title:   Flying Trapeze
// Family:  stage
// Idea:    Looking up into a circus big top at night, a flyer swings out from the board, lets go at the top of the arc, turns her somersaults in the follow spots and is caught by the catcher hanging by his knees, then swings home to the bar or drops into the safety net over the dark crowd.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the flying trapeze act Jules Léotard first flew at the Cirque Napoléon in 1859
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Lights=0..1, Speed=0.2..3, Turns=1..3, Haze=0..1
//
// Knob 1: Lights. The gels in the follow spots and the sequins on the costumes: warm white and gold at 0, amber and rose, then pink and lavender, and at 1 one pink spot and one blue. The house light on the canvas turns with them.
// Knob 2: Speed. How fast the act runs: at 2 a swing of the fly bar takes 2.4 s and a flyer lets go every eight to ten seconds; at 0.2 it all runs ten times slower.
// Knob 3: Turns. The somersaults in the trick, one, two or three. A bigger trick swings higher and flies longer, and the house goes darker for it while every spot finds the flyer.
// Knob 4: Haze. How much haze hangs under the canvas. A little shows the beams as thin shafts; turned up they swell and the whole tent glows in the gels.
// Buttons: K1 tap starts a drum roll: the next trick is the triple, and it ends in the net.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, sin, cos, abs, sqrt, exp, floor, ceil, round, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const ease = (s) => s - sin(TAU * s) * (0.8 / TAU);
// One swing of the fly bar, in seconds at Speed 2.
const PB = 2.4;
const OM = TAU / PB;
// The fly bar's crane and rope, and the catcher's cradle, rope and swing.
const [PFX, PFY, LF] = [24, 30, 34];
const [PCX, PCY, LC, B] = [57, 30, 20, 0.18];
// The board's top, where the next flyer waits, and the ladder.
const [BY, WX, LX] = [68, 1.2, 2.6];
// Figure scale, hips above the feet, hands above the hips.
const SC = 1;
const LEG = 3.8 * SC;
const HL = 5.7 * SC;
const G = 90;
const TR = 0.45;
// Follow spots, below the panel behind the crowd, and how fast their cones open.
const SPOT = [
  [-14, 166],
  [78, 166],
  [32, 186],
];
const TA = 0.046;

// Gels by the Lights knob: house wash (0..1), three spots, two flyers and the catcher.
const PAL = [
  [[1, 0.8, 0.52], [255, 226, 170], [255, 244, 222], [255, 206, 120], [255, 182, 36], [205, 222, 255], [70, 120, 255]],
  [[1, 0.64, 0.5], [255, 182, 120], [255, 150, 150], [255, 208, 150], [255, 96, 112], [255, 206, 60], [250, 240, 230]],
  [[0.82, 0.52, 0.86], [255, 122, 196], [186, 142, 255], [255, 166, 214], [255, 62, 196], [160, 104, 255], [110, 236, 214]],
  [[0.46, 0.44, 1], [255, 76, 170], [66, 128, 255], [172, 96, 255], [255, 44, 156], [36, 150, 255], [245, 245, 255]],
];
const SKIN = [255, 196, 156];
const STEEL = [170, 176, 190];
const ROPE = [150, 138, 116];

function palette(S, k) {
  const u = cl(k, 0, 1) * 3;
  const i = min(2, floor(u));
  const f = u - i;
  for (let j = 0; j < 7; j++) for (let c = 0; c < 3; c++) S.P[j][c] = mix(PAL[i][j][c], PAL[i + 1][j][c], f);
}

const mkF = (c) => ({ m: 'wait', x: WX, y: BY - LEG, ph: 0, fs: 1, a1: 2.9, a2: 2.9, l1: 0, l2: 0, k1: 0, k2: 0, hx: null, hy: 0, T: 0, vx: 0, vy: 0, px: WX, py: BY - LEG, c });
function rest(f) {
  f.l1 = f.l2 = f.k1 = f.k2 = 0;
  f.a1 = f.a2 = 2.9;
  f.hx = null;
}

export function setup(params) {
  const S = {
    t: 0,
    started: false,
    F: new Float32Array(N * 3),
    LT: new Float32Array(N * 3),
    CA: new Float32Array(N * 3),
    CI: new Float32Array(N),
    AUD: new Float32Array(N),
    ROW: new Int8Array(N).fill(-1),
    POOL: new Float32Array(H),
    bar: 'free',
    A: 0.55,
    rd: null,
    phc: 0,
    ct: null,
    psi: 0,
    fl: [mkF(4), mkF(5)],
    star: 0,
    sp: SPOT.map(([sx, sy]) => ({ sx, sy, ax: 30, ay: 50, ux: 0, uy: -1, D: 110 })),
    drum: 0,
    drumB: 0,
    pop: 0,
    wash: 1,
    trip: false,
    nextFin: true,
    turns: 1,
    net: { s: 0, v: 0, x: 32 },
    fx: [],
    phones: [],
    P: PAL[0].map((c) => c.slice()),
    hz: 0.3,
  };
  // The canvas: red and cream panels running down from the peak, each billowing between its seams.
  for (let y = 0; y < H; y++) {
    S.POOL[y] = exp(-(((y - 17) / 15) ** 2));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = x - 32;
      const dy = y - 5;
      const a = atan2(dx, dy);
      const red = 0.5 + 0.5 * cl(sin(a * 7) * 4, -1, 1);
      const bil = 0.84 - 0.16 * cos(a * 14);
      const near = sm(2.5, 6, sqrt(dx * dx + dy * dy));
      S.CA[i * 3] = mix(0.95, 0.88, red) * bil * near;
      S.CA[i * 3 + 1] = mix(0.86, 0.12, red) * bil * near;
      S.CA[i * 3 + 2] = mix(0.68, 0.12, red) * bil * near;
      S.CI[i] = (0.3 + 0.7 * exp(-((dx * dx) / 900 + (dy * dy) / 300))) * sm(40, 20, y);
    }
  }
  // The crowd: rows of heads and shoulders, bigger towards the front.
  const rows = [
    [108.5, 1.9, 4.6],
    [114, 2.3, 5.4],
    [120.5, 2.8, 6.4],
    [127.5, 3.4, 7.6],
  ];
  rows.forEach(([base, r, gap], k) => {
    for (let cx = -2 + Math.random() * gap; cx < W + 3; cx += gap * (0.8 + 0.4 * Math.random())) {
      const hy = base - r * 1.15 + (Math.random() - 0.5) * 1.2;
      const hx = cx + (Math.random() - 0.5);
      for (let y = max(0, floor(hy - r - 1)); y < H; y++)
        for (let x = max(0, floor(hx - r * 2.4)); x <= min(W - 1, ceil(hx + r * 2.4)); x++) {
          const hd = r + 0.5 - sqrt((x - hx) ** 2 + (y - hy) ** 2);
          const sh = 1 - sqrt(((x - hx) / (r * 2.2)) ** 2 + ((y - base) / (r * 0.9)) ** 2);
          const c = y >= base ? 1 : cl(max(hd, sh * r * 2), 0, 1);
          const i = y * W + x;
          if (c > S.AUD[i]) S.AUD[i] = c;
          if (c > 0.5) S.ROW[i] = k;
        }
      if (Math.random() < 0.09) S.phones.push([round(hx + 1), round(hy - r - 1)]);
    }
  });
  params.s = S;
}

// The catcher on his cradle at swing angle psi: knees over the bar, body and arms hanging.
function cpose(psi) {
  const ps = psi * 1.2;
  const bx = PCX + LC * sin(psi);
  const by = PCY + LC * cos(psi);
  const sx = sin(ps);
  const sy = cos(ps);
  const hx = bx + 1.9 * SC * sx;
  const hy = by + 1.9 * SC * sy;
  const shx = hx + 3 * SC * sx;
  const shy = hy + 3 * SC * sy;
  // Arms reach down and a little towards the flyer.
  const ax = sx * cos(0.2) - cos(ps) * sin(0.2);
  const ay = sy * cos(0.2) + sin(ps) * sin(0.2);
  return { bx, by, x: hx, y: hy, ph: PI - ps, hx: shx + 2.7 * SC * ax, hy: shy + 2.7 * SC * ay };
}

const barAt = (th) => [PFX + LF * sin(th), PFY + LF * cos(th)];

function newRound(S, go, who) {
  const trip = S.trip;
  S.trip = false;
  const turns = trip ? 3 : S.turns;
  const fin = trip || S.nextFin;
  S.nextFin = !fin;
  const tf = 0.75 + 0.25 * turns;
  const tr = go + 1.5 * PB;
  S.rd = { turns, fin, tf, h: 8 + 3 * turns, tg: go, tr, tc: tr + tf, rel: false, A0: S.A, A: 0.55 + 0.03 * (turns - 1), t0: S.t, over: false, cnt: 0 };
  S.star = who;
  // The catcher times his swing to be out at the front of it when she arrives.
  const dt = max(0.3, S.rd.tc - S.t);
  let k = round((S.phc + OM * dt) / TAU);
  if ((TAU * k - S.phc) / dt < 0.6 * OM) k++;
  S.ct = { ph: TAU * k, t: S.rd.tc, ev: 0 };
}

function burst(S, n) {
  for (let i = 0; i < n; i++) S.fx.push({ x: 2 + Math.random() * 60, y: 106 + Math.random() * 20, a: 1, w: Math.random() * 0.25 });
}

function netY(x) {
  return 98.5 + 1.6 * sin((PI * cl(x, 0, 63)) / 63);
}

function catcherEvent(S, ev) {
  const rd = S.rd;
  const f = S.fl[S.star];
  if (ev === 0) {
    if (f.m === 'fly') f.m = 'caught';
    S.pop = 1;
    burst(S, 7);
    S.ct = rd.fin ? { ph: S.phc + 1.5 * PI, t: S.t + 2.4, ev: 2 } : { ph: S.phc + TAU, t: rd.tg + 3.5 * PB - TR, ev: 1 };
  } else if (ev === 1) {
    f.m = 'ret';
    f.T = 0;
    f.sx = f.x;
    f.sy = f.y;
    f.ph0 = f.ph;
  } else {
    f.m = 'drop';
    f.T = 0;
    f.ph0 = f.ph;
    f.vx = f.vx0;
    f.vy = f.vy0;
    const dy = netY(f.x + f.vx * 0.9) - 1 - f.y;
    f.TF = (-f.vy + sqrt(f.vy * f.vy + 2 * G * max(1, dy))) / G;
    rd.over = true;
  }
}

function stepFlyer(S, f, d, i) {
  const rd = S.rd;
  const t = S.t;
  f.T += d;
  const [hbx, hby] = barAt(-S.A);
  const th = S.th;
  const [bx, by] = barAt(th);
  switch (f.m) {
    case 'wait':
      rest(f);
      f.fs = 1;
      f.x += cl(WX - f.x, -6 * d, 6 * d);
      f.y = BY - LEG;
      f.ph = 0.04 * sin(t * 1.3 + i);
      break;
    case 'hold':
      rest(f);
      f.fs = 1;
      f.x += cl(hbx - 1 - f.x, -7 * d, 7 * d);
      f.y = BY - LEG;
      f.ph = 0.12 * sm(3, 0.5, abs(hbx - 1 - f.x));
      if (abs(hbx - 1 - f.x) < 1.5) {
        f.hx = hbx;
        f.hy = hby;
      }
      if (t >= rd.tg) {
        S.bar = 'free';
        f.m = 'swing';
        f.T = 0;
        f.sx = f.x;
        f.sy = f.y;
      }
      break;
    case 'swing':
    case 'ride': {
      f.fs = f.m === 'ride' ? -1 : 1;
      const k = f.m === 'swing' ? sm(0, 0.3, f.T) : 1;
      f.x = mix(f.sx, bx + HL * sin(th), k);
      f.y = mix(f.sy, by + HL * cos(th), k);
      f.ph = -th * k;
      const u = (f.fs * th) / S.A;
      f.l1 = f.l2 = (0.95 * max(0, u) + 0.35 * min(0, u)) * k;
      f.k1 = f.k2 = 0.25 * max(0, -u) * k;
      f.hx = bx;
      f.hy = by;
      if (f.m === 'swing' && !rd.rel && t >= rd.tr) {
        const c = cpose(-B);
        f.m = 'fly';
        rd.rel = true;
        f.Rx = f.x;
        f.Ry = f.y;
        f.Cx = c.hx + HL * sin(-0.8 * B);
        f.Cy = c.hy + HL * cos(-0.8 * B);
        f.phR = f.ph;
        f.pkR = f.l1;
        f.hx = null;
      }
      if (f.m === 'ride' && t >= rd.tg + 4 * PB) {
        // Home on the board. The flyer who was waiting takes the bar next.
        S.bar = 'hook';
        rd.over = true;
        f.m = 'land';
        f.T = 0;
        f.sx = f.x;
        f.sy = f.y;
        const o = S.fl[1 - i];
        if (o.m === 'wait') {
          o.m = 'hold';
          f.next = 'wait';
          newRound(S, t + 1.1, 1 - i);
        } else {
          f.next = 'hold';
          newRound(S, t + 1.1, i);
        }
      }
      break;
    }
    case 'fly': {
      const s = cl((t - rd.tr) / rd.tf, 0, 1);
      f.x = mix(f.Rx, f.Cx, s);
      f.y = mix(f.Ry, f.Cy, s) - 4 * rd.h * s * (1 - s);
      f.ph = mix(f.phR, 0.8 * B - TAU * rd.turns, ease(s));
      const u = sm(0.04, 0.22, s) * (1 - sm(0.7, 0.9, s));
      f.l1 = f.l2 = max(f.pkR * (1 - sm(0, 0.12, s)), 2.2 * u);
      f.k1 = f.k2 = 2.4 * u;
      f.a1 = f.a2 = 2 * u;
      f.hx = null;
      break;
    }
    case 'caught': {
      const c = S.cp;
      const tp = S.psi * 0.8;
      f.x = c.hx + HL * sin(tp);
      f.y = c.hy + HL * cos(tp);
      f.ph = -tp;
      f.fs = 1;
      f.l1 = f.l2 = 0.4 * sin(S.phc + 0.6);
      f.k1 = f.k2 = 0;
      f.hx = c.hx;
      f.hy = c.hy;
      break;
    }
    case 'ret': {
      // A half turn in the air and back to the fly bar, which comes out to meet her.
      const s = cl(f.T / TR, 0, 1);
      const [ex, ey] = barAt(rd.A);
      f.x = mix(f.sx, ex + HL * sin(rd.A), s);
      f.y = mix(f.sy, ey + HL * cos(rd.A), s) - 18 * s * (1 - s);
      f.ph = mix(f.ph0, -rd.A, s);
      f.fs = s < 0.5 ? 1 : -1;
      f.a1 = 1.3 * sin(PI * s);
      f.a2 = -f.a1;
      f.l1 = f.l2 = 0.3 * sin(PI * s);
      f.hx = null;
      if (s >= 1) f.m = 'ride';
      break;
    }
    case 'land': {
      const k = sm(0, 0.35, f.T);
      f.x = mix(f.sx, hbx - 1, k);
      f.y = mix(f.sy, BY - LEG, k);
      f.ph = mix(f.ph, 0, k);
      rest(f);
      f.hx = hbx;
      f.hy = hby;
      if (f.T > 0.4) f.m = f.next;
      break;
    }
    case 'drop': {
      f.vy += G * d;
      f.x += f.vx * d;
      f.y += f.vy * d;
      const s = cl(f.T / f.TF, 0, 1);
      f.ph = mix(f.ph0, -PI / 2 - TAU, ease(s));
      const u = sm(0.1, 0.3, s) * (1 - sm(0.62, 0.85, s));
      f.l1 = f.l2 = 2.2 * u;
      f.k1 = f.k2 = 2.4 * u;
      f.a1 = f.a2 = 2 * u + 0.6 * (1 - u);
      f.hx = null;
      if (f.y >= netY(f.x) - 1) {
        f.m = 'net';
        f.T = 0;
        S.net.x = f.x;
        S.pop = max(S.pop, 0.8);
        burst(S, 6);
      }
      break;
    }
    case 'net': {
      // Bouncing on the net: a stiff spring while she is in it, a fall while she is out.
      const n = ceil(d / 0.006);
      const h = d / max(1, n);
      for (let j = 0; j < n; j++) {
        const pen = f.y - (netY(f.x) - 1);
        const acc = G - (pen > 0 ? 420 * pen + 7 * f.vy : 0);
        f.vy += acc * h;
        f.y += f.vy * h;
        f.x += f.vx * h;
        f.vx *= 1 - 2.5 * h;
        if (pen > 0) {
          S.net.s = pen;
          S.net.v = f.vy;
        } else {
          S.net.v += (-900 * S.net.s - 22 * S.net.v) * h;
          S.net.s += S.net.v * h;
        }
      }
      S.net.x = f.x;
      S.net.hold = true;
      f.ph = -PI / 2;
      f.l1 = f.l2 = 0.6;
      f.k1 = f.k2 = 0.4;
      f.a1 = 1.6 + 0.5 * sin(f.T * 9);
      f.a2 = 1.6 - 0.5 * sin(f.T * 9);
      if (f.T > 2.6) {
        f.m = 'up';
        f.T = 0;
        f.sy = f.y;
      }
      break;
    }
    case 'up':
    case 'tada':
    case 'walk': {
      S.net.s += (1.5 - S.net.s) * min(1, d * 8);
      S.net.v = 0;
      S.net.x = f.x;
      S.net.hold = true;
      const top = netY(f.x) + S.net.s - LEG - 0.6;
      if (f.m === 'up') {
        const k = sm(0, 0.5, f.T);
        f.ph = mix(-PI / 2, 0, k);
        f.y = mix(f.sy, top, k);
        rest(f);
        if (f.T > 0.55) (f.m = 'tada'), (f.T = 0);
      } else if (f.m === 'tada') {
        // Arms up for the crowd.
        f.ph = 0;
        f.y = top;
        f.a1 = 0.55;
        f.a2 = -0.55;
        if (f.T > 0.8) (f.m = 'walk'), (f.T = 0);
      } else {
        f.fs = -1;
        f.x -= 13 * d;
        f.y = top - 1.1 * abs(sin(f.T * 8));
        f.ph = 0;
        f.l1 = 0.5 * sin(f.T * 8);
        f.l2 = -f.l1;
        f.a1 = PI - 0.5 * sin(f.T * 8);
        f.a2 = PI + 0.5 * sin(f.T * 8);
        if (f.x <= LX) (f.m = 'climb'), (f.T = 0);
      }
      break;
    }
    case 'climb': {
      // Up the rope ladder to the board.
      f.x = LX;
      f.y -= 12 * d;
      f.fs = -1;
      f.ph = 0;
      const w = sin(f.T * 9);
      f.a1 = 0.35 + 0.45 * w;
      f.a2 = 0.35 - 0.45 * w;
      f.l1 = 0.9 * max(0, w);
      f.l2 = 0.9 * max(0, -w);
      f.k1 = 1.5 * max(0, w);
      f.k2 = 1.5 * max(0, -w);
      f.hx = null;
      if (f.y <= BY - LEG) {
        f.y = BY - LEG;
        f.m = 'wait';
      }
      break;
    }
  }
  if (d > 0) {
    f.vx0 = (f.x - f.px) / d;
    f.vy0 = (f.y - f.py) / d;
  }
  f.px = f.x;
  f.py = f.y;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const rdt = cl(dt || 0, 0, 0.1);
  const d = rdt * (cl(kv[1], 0.2, 3) / 2);
  palette(S, kv[0]);
  S.turns = cl(round(kv[2]), 1, 3);
  S.hz = 0.26 + 0.74 * cl(kv[3], 0, 1);
  if (!S.started) {
    // Open mid-act: the first flyer is already out on her first swing.
    S.started = true;
    S.fl[0].m = 'swing';
    S.fl[0].T = 1;
    S.fl[0].sx = S.fl[0].sy = 0;
    newRound(S, -0.9, 0);
    S.A = S.rd.A;
    S.bar = 'free';
    S.phc = S.ct.ph - OM * S.rd.tc;
  }
  const tp = S.t;
  S.t += d;
  const t = S.t;
  const rd = S.rd;
  if (input.btnPressed && input.btnPressed[0]) {
    S.drumB = 1;
    if (!rd.rel && !rd.over) {
      rd.turns = 3;
      rd.fin = true;
      S.nextFin = false;
      rd.tf = 1.5;
      rd.h = 17;
      rd.tc = rd.tr + rd.tf;
      if (S.ct && S.ct.ev === 0) S.ct.t = rd.tc;
    } else S.trip = true;
  }
  S.A = S.bar === 'hook' && !rd.over ? mix(rd.A0, rd.A, sm(rd.t0, rd.tg, t)) : rd.A;
  S.th = S.bar === 'hook' ? -S.A : -S.A * cos(OM * (t - rd.tg));
  // The catcher, phase-locked to the next thing he has to be on time for.
  if (S.ct) {
    const rem = S.ct.t - tp;
    if (rem <= d) {
      S.phc = S.ct.ph;
      const ev = S.ct.ev;
      S.ct = null;
      S.psi = -B * cos(S.phc);
      S.cp = cpose(S.psi);
      catcherEvent(S, ev);
    } else S.phc += ((S.ct.ph - S.phc) * d) / rem;
  } else S.phc += OM * d;
  S.psi = -B * cos(S.phc);
  S.cp = cpose(S.psi);
  S.net.hold = false;
  for (let i = 0; i < 2; i++) stepFlyer(S, S.fl[i], d, i);
  if (!S.net.hold) {
    S.net.v += (-900 * S.net.s - 22 * S.net.v) * min(d, 0.02);
    S.net.s += S.net.v * min(d, 0.02);
    S.net.s *= exp(-d * 3);
  }
  // After a drop the bar swings empty until it comes back to the board and the next flyer hooks it.
  const r2 = S.rd;
  if (r2.over && S.bar === 'free') {
    const c = floor((t - r2.tg) / PB);
    if (c > floor((tp - r2.tg) / PB)) {
      const w = S.fl.findIndex((f) => f.m === 'wait');
      if (w >= 0) {
        S.bar = 'hook';
        S.fl[w].m = 'hold';
        newRound(S, t + 0.7, w);
      }
    }
  }
  // Light cues: the house dims for the drum roll and comes up on the catch.
  const R = S.rd;
  const star = S.fl[S.star];
  const roll = (!R.rel && t > R.tg + 0.5 * PB) || star.m === 'fly' || S.drumB > 0 ? 1 : 0;
  S.drum += (roll - S.drum) * (1 - exp(-d * 4));
  S.drumB = max(0, S.drumB - rdt * 0.4);
  S.pop *= exp(-d * 0.9);
  const dim = 0.7 - 0.22 * (R.turns - 1);
  S.wash = (1 - S.drum * (1 - dim)) * (1 + 0.8 * S.pop);
  // The follow spots: two on the flyer, the third on the catcher unless the trick is big.
  const fin = S.fl.find((f) => f.m === 'drop' || f.m === 'net' || f.m === 'up' || f.m === 'tada');
  const t0 = fin || star;
  const t1 = fin && t < R.tg + 0.4 ? fin : star;
  const big = S.drum > 0.5 && R.turns >= 2;
  const tg = [t0, t1, big ? star : { x: S.cp.x, y: S.cp.y + 3 }];
  const k = 1 - exp(-d * 8);
  for (let j = 0; j < 3; j++) {
    const s = S.sp[j];
    s.ax += (tg[j].x - s.ax) * k;
    s.ay += (tg[j].y - 1 - s.ay) * k;
    const vx = s.ax - s.sx;
    const vy = s.ay - s.sy;
    s.D = sqrt(vx * vx + vy * vy);
    s.ux = vx / s.D;
    s.uy = vy / s.D;
  }
  // Camera flashes in the crowd.
  if (Math.random() < rdt * 0.9) burst(S, 1);
  for (const e of S.fx) e.a -= rdt * 9;
  S.fx = S.fx.filter((e) => e.a > 0);
}

// A stroke lit by the light field, with optional sequin sparkle.
function seg(S, ax, ay, bx, by, r, c, sp) {
  const F = S.F;
  const L = S.LT;
  const x0 = max(0, floor(min(ax, bx) - r - 1));
  const x1 = min(W - 1, ceil(max(ax, bx) + r + 1));
  const y0 = max(0, floor(min(ay, by) - r - 1));
  const y1 = min(H - 1, ceil(max(ay, by) + r + 1));
  const dx = bx - ax;
  const dy = by - ay;
  const ll = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = cl(((x - ax) * dx + (y - ay) * dy) / ll, 0, 1);
      const ex = x - ax - dx * t;
      const ey = y - ay - dy * t;
      const a = cl(r + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (a <= 0) continue;
      const q = (y * W + x) * 3;
      const s = sp ? 0.72 + 0.56 * Math.random() : 1;
      F[q] += (c[0] * L[q] * s - F[q]) * a;
      F[q + 1] += (c[1] * L[q + 1] * s - F[q + 1]) * a;
      F[q + 2] += (c[2] * L[q + 2] * s - F[q + 2]) * a;
    }
}

function glow(S, x, y, r, c, k) {
  const F = S.F;
  for (let yy = max(0, floor(y - r)); yy <= min(H - 1, ceil(y + r)); yy++)
    for (let xx = max(0, floor(x - r)); xx <= min(W - 1, ceil(x + r)); xx++) {
      const g = k * exp(-((xx - x) ** 2 + (yy - y) ** 2) / (0.25 * r * r));
      const q = (yy * W + xx) * 3;
      F[q] += c[0] * g;
      F[q + 1] += c[1] * g;
      F[q + 2] += c[2] * g;
    }
}

// A stick figure: hips at (x, y), body angle ph (0 is head up), facing fs.
function fig(S, f, col) {
  const bx = sin(f.ph);
  const by = -cos(f.ph);
  const nx = cos(f.ph) * f.fs;
  const ny = sin(f.ph) * f.fs;
  const dv = (a, l) => [(bx * cos(a) + nx * sin(a)) * l, (by * cos(a) + ny * sin(a)) * l];
  const shx = f.x + bx * 3 * SC;
  const shy = f.y + by * 3 * SC;
  for (const [l, k] of [
    [f.l1, f.k1],
    [f.l2, f.k2],
  ]) {
    const [kx, ky] = dv(PI - l, 1.9 * SC);
    const [fx, fy] = dv(PI - l + k, 1.9 * SC);
    seg(S, f.x, f.y, f.x + kx, f.y + ky, 0.6, col, 1);
    seg(S, f.x + kx, f.y + ky, f.x + kx + fx, f.y + ky + fy, 0.5, col, 1);
  }
  seg(S, f.x, f.y, shx, shy, 0.8, col, 1);
  for (const a of [f.a1, f.a2]) {
    let ex = f.hx;
    let ey = f.hy;
    if (ex === null) {
      const [ax, ay] = dv(a, 2.7 * SC);
      ex = shx + ax;
      ey = shy + ay;
    }
    seg(S, shx, shy, ex, ey, 0.42, SKIN, 0);
  }
  seg(S, shx + bx * 1.45 * SC, shy + by * 1.45 * SC, shx + bx * 1.55 * SC, shy + by * 1.55 * SC, 0.75, SKIN, 0);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { F, LT, CA, CI, AUD, POOL, P } = S;
  const wash = S.wash;
  const wc = P[0];
  const hz = S.hz;
  const hzA = hz * (0.7 - 0.22 * hz);
  const halo = hz * hz * 0.18;
  const hl = Math.log(max(1, halo * 400));
  const amb = 0.12 + 0.12 * wash;
  const sp = S.sp.map((s, j) => [s.sx, s.sy, s.ux, s.uy, s.D, P[1 + j][0] / 255, P[1 + j][1] / 255, P[1 + j][2] / 255]);
  const kc = 0.48 * 255 * wash;
  const air = 9 * hz * wash;
  for (let y = 0; y < H; y++) {
    const pb = POOL[y];
    // The ring below the crowd glows in the house light.
    const ring = 50 * sm(117, 104, y) * sm(100, 104, y) * wash;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const q = i * 3;
      const ci = CI[i] * kc;
      let r = 4 + wc[0] * (air + ring) + CA[q] * wc[0] * ci;
      let g = 4 + wc[1] * (air + ring) + CA[q + 1] * wc[1] * ci;
      let b = 9 + wc[2] * (air + ring) + CA[q + 2] * wc[2] * ci;
      let lr = amb * wc[0];
      let lg = amb * wc[1];
      let lb = amb * wc[2];
      const cv = CI[i] > 0.02 ? 0.9 * pb * sm(0, 0.3, CI[i]) * 255 : 0;
      for (let j = 0; j < 3; j++) {
        const s = sp[j];
        const vx = x - s[0];
        const vy = y - s[1];
        const al = vx * s[2] + vy * s[3];
        const pp = abs(vx * s[3] - vy * s[2]);
        const R = 0.8 + al * TA;
        if (pp < R) {
          const p = sm(R, R * 0.45, pp);
          lr += s[5] * p * 1.2;
          lg += s[6] * p * 1.2;
          lb += s[7] * p * 1.2;
          const fb = (al > s[4] ? 0.8 : 1) * 1.3 / (1 + (al / 110) ** 2);
          const k = p * fb * hzA * 255;
          r += s[5] * k;
          g += s[6] * k;
          b += s[7] * k;
          // Past the flyer the beam lands on the canvas as a pool.
          if (cv > 0 && al > s[4]) {
            const c = cv * p;
            r += CA[q] * s[5] * c;
            g += CA[q + 1] * s[6] * c;
            b += CA[q + 2] * s[7] * c;
          }
        }
        if (pp < (R + 9) * hl) {
          const h = halo * exp(-pp / (R + 9)) * 255;
          r += s[5] * h;
          g += s[6] * h;
          b += s[7] * h;
        }
      }
      F[q] = r;
      F[q + 1] = g;
      F[q + 2] = b;
      LT[q] = min(1.25, lr);
      LT[q + 1] = min(1.25, lg);
      LT[q + 2] = min(1.25, lb);
    }
  }
  const t = S.t;
  // The bale ring at the peak and its ring of bulbs.
  seg(S, 32, 7, 32, 29, 0.7, STEEL, 0);
  for (let j = 0; j < 22; j++) {
    const a = (TAU * j) / 22;
    const x = 32 + 20 * sin(a);
    const y = 6.5 + 5 * cos(a);
    const ch = (((j / 22 - t * 0.9) % 1) + 1) % 1 < 0.22 ? 1 : 0;
    let v = 0.75 + 0.15 * sin(t * 3 + j * 2.1);
    v = mix(v, 0.3 + 0.9 * ch, S.drum) + 0.5 * S.pop;
    v *= 0.7 + 0.3 * cos(a) * 0.5 + 0.15;
    glow(S, x, y, 3.2, [255, 196, 110], 0.42 * v);
    const q = (round(y) * W + round(x)) * 3;
    F[q] += 200 * v;
    F[q + 1] += 160 * v;
    F[q + 2] += 90 * v;
  }
  seg(S, 30, 5, 34, 5, 1.1, [60, 62, 70], 0);
  // The rig: a truss under the peak, guy lines, the uprights, the board and the ladder.
  seg(S, 3, PFY - 2, 61, PFY - 2, 0.4, STEEL, 0);
  seg(S, 3, PFY, 61, PFY, 0.35, STEEL, 0);
  for (let x = 5; x < 61; x += 4) seg(S, x, PFY - 2, x + 2, PFY, 0.25, STEEL, 0);
  seg(S, 4, PFY - 2, 24, 7, 0.25, ROPE, 0);
  seg(S, 60, PFY - 2, 40, 7, 0.25, ROPE, 0);
  seg(S, 62, PFY - 2, 62, 103, 0.35, ROPE, 0);
  seg(S, 0, PFY - 2, 0, BY, 0.35, ROPE, 0);
  const [hbx] = barAt(-S.rd.A);
  seg(S, 0, BY + 0.6, hbx + 0.4, BY + 0.6, 0.55, [190, 160, 120], 0);
  seg(S, 1, BY + 1, 1, 97, 0.3, ROPE, 0);
  seg(S, 4.2, BY + 1, 4.2, 97, 0.3, ROPE, 0);
  for (let y = BY + 3; y < 97; y += 3) seg(S, 1, y, 4.2, y, 0.25, ROPE, 0);
  // The safety net, sagging and dented where a flyer lands in it.
  const nt = S.net;
  for (let x = 0; x < W; x++) {
    const dn = nt.s * exp(-(((x - nt.x) / 8) ** 2));
    const far = 94.5 + 1.2 * sin((PI * x) / 63) + 0.6 * dn;
    const near = 103 + 2 * sin((PI * x) / 63) + dn;
    for (let y = floor(far - 1); y <= ceil(near + 1); y++) {
      if (y < 0 || y >= H) continue;
      const v = (y - far) / (near - far);
      const fa = x * 0.34 + v * 3;
      const fb = x * 0.34 - v * 3;
      let ln = max(sm(0.3, 0.48, abs((fa % 1) - 0.5)), sm(0.3, 0.48, abs((((fb % 1) + 1) % 1) - 0.5)));
      ln *= v > -0.06 && v < 1.06 ? 1 : 0;
      ln = max(ln, sm(0.9, 0.2, abs(y - far)), sm(0.9, 0.2, abs(y - near)));
      if (ln <= 0) continue;
      const q = (y * W + x) * 3;
      F[q] += (205 * LT[q] - F[q]) * ln * 0.8;
      F[q + 1] += (196 * LT[q + 1] - F[q + 1]) * ln * 0.8;
      F[q + 2] += (176 * LT[q + 2] - F[q + 2]) * ln * 0.8;
    }
  }
  // The fly bar on its ropes.
  const [bx, by] = barAt(S.th);
  seg(S, PFX - 1.2, PFY, bx - 1.2, by, 0.28, ROPE, 0);
  seg(S, PFX + 1.2, PFY, bx + 1.2, by, 0.28, ROPE, 0);
  seg(S, bx - 1.8, by, bx + 1.8, by, 0.45, [215, 215, 225], 0);
  // The catcher's cradle and the catcher.
  const c = S.cp;
  seg(S, PCX - 1.2, PCY, c.bx - 1.2, c.by, 0.28, ROPE, 0);
  seg(S, PCX + 1.2, PCY, c.bx + 1.2, c.by, 0.28, ROPE, 0);
  seg(S, c.bx - 1.8, c.by, c.bx + 1.8, c.by, 0.45, [215, 215, 225], 0);
  fig(S, { x: c.x, y: c.y, ph: c.ph, fs: 1, l1: 0, l2: 0, k1: 1.5, k2: 1.3, a1: 0, a2: 0, hx: c.hx, hy: c.hy }, P[6]);
  for (const f of S.fl) fig(S, f, P[f.c]);
  // The crowd in front of it all, a dark sea with phones and camera flashes.
  // Each head is rimmed by the light behind it.
  for (let i = W; i < N; i++) {
    const a = AUD[i];
    if (a <= 0) continue;
    const q = i * 3;
    const k = S.ROW[i];
    const rim = k > S.ROW[i - W] ? (1 - 0.2 * k) * a : 0;
    for (let c = 0; c < 3; c++) F[q + c] += ((12 - 2.5 * k) * wc[c] - F[q + c]) * a + rim * (16 * wash * wc[c] + 60 * max(0, LT[q + c] - 0.3));
  }
  for (const [x, y] of S.phones) {
    if (x < 0 || x > W - 2 || y < 0 || y >= H) continue;
    const q = (y * W + x) * 3;
    F[q] += 70;
    F[q + 1] += 92;
    F[q + 2] += 130;
    F[q + 3] += 70;
    F[q + 4] += 92;
    F[q + 5] += 130;
  }
  for (const e of S.fx) glow(S, e.x, e.y, 2.2, [255, 250, 240], e.a * e.a * (1 - e.w));
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
