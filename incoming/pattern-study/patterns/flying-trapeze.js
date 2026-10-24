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
// Knob 2: Speed. How fast the act runs: at 2 the fly bar swings out and back in 2.4 s and a flyer lets go every eight to eleven seconds; at 0.2 it all runs ten times slower.
// Knob 3: Turns. The somersaults in the trick, one, two or three. A bigger trick swings higher and flies longer, and the house goes darker for it while every spot finds the flyer.
// Knob 4: Haze. How much haze hangs under the canvas. A little shows the beams as thin shafts; turned up they swell and the whole tent glows in the gels.
// Buttons: K1 tap starts a drum roll: the next trick is the triple, and it ends in the net.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, sin, cos, abs, sqrt, exp, floor, ceil, round, atan2, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (s) => s - sin(TAU * s) * (0.8 / TAU);
const rnd = () => Math.random();
// A swing of the fly bar out and back, in seconds at Speed 2.
const PB = 2.4;
const OM = TAU / PB;
// The fly bar's crane and rope; the catcher's cradle, rope and swing.
const [PFX, PFY, LF] = [24, 30, 34];
const [PCX, PCY, LC, B] = [57, 30, 20, 0.18];
// The board's top, where the next flyer waits on it, and the rope ladder.
const [BY, WX, LX] = [68, 1.2, 2.6];
// Hips above feet, hands above hips, gravity, and the time of the flight back to the bar.
const [LEG, HL, G, TR] = [3.8, 5.7, 90, 0.45];
// Follow spots below the panel behind the crowd, and how fast their cones open.
const SPOT = [[-14, 166], [78, 166], [32, 186]];
const TA = 0.046;
// Gels by the Lights knob: house wash (0..1), three spots, two flyers and the catcher.
const PAL = [
  [[1, 0.8, 0.52], [255, 226, 170], [255, 244, 222], [255, 206, 120], [255, 182, 36], [205, 222, 255], [70, 120, 255]],
  [[1, 0.64, 0.5], [255, 182, 120], [255, 150, 150], [255, 208, 150], [255, 96, 112], [255, 206, 60], [250, 240, 230]],
  [[0.82, 0.52, 0.86], [255, 122, 196], [186, 142, 255], [255, 166, 214], [255, 62, 196], [160, 104, 255], [110, 236, 214]],
  [[0.46, 0.44, 1], [255, 76, 170], [66, 128, 255], [172, 96, 255], [255, 44, 156], [36, 150, 255], [245, 245, 255]],
];
const [SKIN, STEEL, ROPE, BAR] = [[255, 196, 156], [170, 176, 190], [150, 138, 116], [215, 215, 225]];
const ONNET = { drop: 1, net: 1, up: 1, tada: 1 };

const mkF = (c) => ({ m: 'wait', x: WX, y: BY - LEG, ph: 0, fs: 1, a1: 2.9, a2: 2.9, l1: 0, l2: 0, k1: 0, k2: 0, hx: null, T: 0, sx: 0, sy: 0, c });
// Thighs, knees and arms of a figure, both sides.
const lim = (f, l1, l2, k1, k2, a1, a2) => Object.assign(f, { l1, l2, k1, k2, a1, a2 });
const rest = (f) => ((f.hx = null), lim(f, 0, 0, 0, 0, 2.9, 2.9));
const barAt = (th) => [PFX + LF * sin(th), PFY + LF * cos(th)];
const netY = (x) => 98.5 + 1.6 * sin((PI * cl(x, 0, 63)) / 63);

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const S = {
    t: 0, started: false, F: F32(N * 3), LT: F32(N * 3), CA: F32(N * 3), CI: F32(N), AUD: F32(N), ROW: new Int8Array(N).fill(-1), POOL: F32(H),
    bar: 'free', A: 0.55, phc: 0, fl: [mkF(4), mkF(5)], star: 0,
    sp: SPOT.map(([sx, sy]) => ({ sx, sy, ax: 30, ay: 50, ux: 0, uy: -1, D: 110 })),
    drum: 0, drumB: 0, pop: 0, wash: 1, trip: false, nextFin: true, turns: 1, net: { s: 0, v: 0, x: 32 }, fx: [], phones: [], P: PAL[0].map((c) => c.slice()), hz: 0.3,
  };
  // The canvas: red and cream panels running down from the peak, each billowing between its seams.
  for (let y = 0; y < H; y++) {
    S.POOL[y] = exp(-(((y - 17) / 15) ** 2));
    for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = x - 32, dy = y - 5, a = atan2(dx, dy);
      const red = 0.5 + 0.5 * cl(sin(a * 7) * 4, -1, 1);
      const k = (0.84 - 0.16 * cos(a * 14)) * sm(2.5, 6, sqrt(dx * dx + dy * dy));
      S.CA[i * 3] = mix(0.95, 0.88, red) * k;
      S.CA[i * 3 + 1] = mix(0.86, 0.12, red) * k;
      S.CA[i * 3 + 2] = mix(0.68, 0.12, red) * k;
      S.CI[i] = (0.3 + 0.7 * exp(-((dx * dx) / 900 + (dy * dy) / 300))) * sm(40, 20, y);
    }
  }
  // The crowd: rows of heads and shoulders, bigger towards the front, each row a solid band below.
  [[108.5, 1.9, 4.6], [114, 2.3, 5.4], [120.5, 2.8, 6.4], [127.5, 3.4, 7.6]].forEach(([base, r, gap], k) => {
    for (let cx = -2 + rnd() * gap; cx < W + 3; cx += gap * (0.8 + 0.4 * rnd())) {
      const hy = base - r * 1.15 + (rnd() - 0.5) * 1.2, hx = cx + rnd() - 0.5;
      for (let y = max(0, floor(hy - r - 1)); y < H; y++)
        for (let x = max(0, floor(hx - r * 2.4)); x <= min(W - 1, ceil(hx + r * 2.4)); x++) {
          const hd = r + 0.5 - sqrt((x - hx) ** 2 + (y - hy) ** 2);
          const sh = 1 - sqrt(((x - hx) / (r * 2.2)) ** 2 + ((y - base) / (r * 0.9)) ** 2);
          const c = y >= base ? 1 : cl(max(hd, sh * r * 2), 0, 1), i = y * W + x;
          if (c > S.AUD[i]) S.AUD[i] = c;
          if (c > 0.5) S.ROW[i] = k;
        }
      if (rnd() < 0.09) S.phones.push([round(hx + 1), round(hy - r - 1)]);
    }
  });
  params.s = S;
}

// The catcher at swing angle psi: knees over the bar, body hanging, arms reaching for the flyer.
function cpose(psi) {
  const ps = psi * 1.2, bx = PCX + LC * sin(psi), by = PCY + LC * cos(psi), sx = sin(ps), sy = cos(ps);
  const hx = bx + 1.9 * sx, hy = by + 1.9 * sy;
  const ax = sx * cos(0.2) - sy * sin(0.2), ay = sy * cos(0.2) + sx * sin(0.2);
  return { bx, by, x: hx, y: hy, ph: PI - ps, fs: 1, l1: 0, l2: 0, k1: 1.5, k2: 1.3, hx: hx + 3 * sx + 2.7 * ax, hy: hy + 3 * sy + 2.7 * ay };
}

function newRound(S, go, who) {
  const trip = S.trip, turns = trip ? 3 : S.turns, fin = trip || S.nextFin, tf = 0.75 + 0.25 * turns, tr = go + 1.5 * PB;
  S.trip = false;
  S.nextFin = !fin;
  S.rd = { turns, fin, tf, h: 8 + 3 * turns, tg: go, tr, tc: tr + tf, rel: false, A0: S.A, A: 0.55 + 0.03 * (turns - 1), t0: S.t, over: false };
  S.star = who;
  // The catcher times his swing to be out at the front of it when she arrives.
  const dt = max(0.3, S.rd.tc - S.t);
  let k = round((S.phc + OM * dt) / TAU);
  if ((TAU * k - S.phc) / dt < 0.6 * OM) k++;
  S.ct = { ph: TAU * k, t: S.rd.tc, ev: 0 };
}

const burst = (S, n) => {
  for (let i = 0; i < n; i++) S.fx.push({ x: 2 + rnd() * 60, y: 106 + rnd() * 20, a: 1, w: rnd() * 0.25 });
};

function catcherEvent(S, ev) {
  const rd = S.rd, f = S.fl[S.star];
  f.T = 0;
  f.ph0 = f.ph;
  if (ev === 0) {
    // The catch: the house comes up and the crowd's cameras go off.
    if (f.m === 'fly') f.m = 'caught';
    burst(S, 7, (S.pop = 1));
    S.ct = rd.fin ? { ph: S.phc + 1.5 * PI, t: S.t + 2.4, ev: 2 } : { ph: S.phc + TAU, t: rd.tg + 3.5 * PB - TR, ev: 1 };
  } else if (ev === 1) [f.m, f.sx, f.sy] = ['ret', f.x, f.y];
  else {
    // He lets her go on the swing back, and she falls turning over into the net.
    [f.m, f.vx, f.vy] = ['drop', f.vx0, f.vy0];
    const dy = netY(f.x + f.vx * 0.9) - 1 - f.y;
    f.TF = (-f.vy + sqrt(f.vy * f.vy + 2 * G * max(1, dy))) / G;
    rd.over = true;
  }
}

function stepFlyer(S, f, d, i) {
  const rd = S.rd, t = S.t, th = S.th, [hbx, hby] = barAt(-S.A), [bx, by] = barAt(th), nt = S.net;
  f.T += d;
  switch (f.m) {
    case 'wait':
    case 'hold': {
      // Standing on the board; the one whose turn it is steps up and takes the bar.
      const h = f.m === 'hold', gx = h ? hbx - 1 : WX;
      rest(f);
      f.x += cl(gx - f.x, -7 * d, 7 * d);
      [f.fs, f.y, f.ph] = [1, BY - LEG, h ? 0.12 * sm(3, 0.5, abs(gx - f.x)) : 0.04 * sin(t * 1.3 + i)];
      if (!h) break;
      if (abs(gx - f.x) < 1.5) [f.hx, f.hy] = [hbx, hby];
      if (t >= rd.tg) [S.bar, f.m, f.T, f.sx, f.sy] = ['free', 'swing', 0, f.x, f.y];
      break;
    }
    case 'swing':
    case 'ride': {
      f.fs = f.m === 'ride' ? -1 : 1;
      const k = f.m === 'swing' ? sm(0, 0.3, f.T) : 1, u = (f.fs * th) / S.A;
      [f.x, f.y, f.ph] = [mix(f.sx, bx + HL * sin(th), k), mix(f.sy, by + HL * cos(th), k), -th * k];
      // Legs lead at the front of each swing and trail at the back.
      const l = (0.95 * max(0, u) + 0.35 * min(0, u)) * k;
      lim(f, l, l, 0.25 * max(0, -u) * k, 0.25 * max(0, -u) * k, f.a1, f.a2);
      [f.hx, f.hy] = [bx, by];
      if (f.m === 'swing' && !rd.rel && t >= rd.tr) {
        // Let go at the top of the swing, aimed at where the catcher's hands will be.
        const c = cpose(-B);
        rd.rel = true;
        Object.assign(f, { m: 'fly', Rx: f.x, Ry: f.y, Cx: c.hx + HL * sin(-0.8 * B), Cy: c.hy + HL * cos(-0.8 * B), phR: f.ph, pkR: f.l1, hx: null });
      }
      if (f.m === 'ride' && t >= rd.tg + 4 * PB) {
        // Home on the board. The flyer who was waiting takes the bar next.
        S.bar = 'hook';
        rd.over = true;
        [f.m, f.T, f.sx, f.sy] = ['land', 0, f.x, f.y];
        const o = S.fl[1 - i];
        if (o.m === 'wait') o.m = 'hold';
        f.next = o.m === 'hold' ? 'wait' : 'hold';
        newRound(S, t + 1.1, o.m === 'hold' ? 1 - i : i);
      }
      break;
    }
    case 'fly': {
      const s = cl((t - rd.tr) / rd.tf, 0, 1), u = sm(0.04, 0.22, s) * (1 - sm(0.7, 0.9, s));
      [f.x, f.y, f.ph] = [mix(f.Rx, f.Cx, s), mix(f.Ry, f.Cy, s) - 4 * rd.h * s * (1 - s), mix(f.phR, 0.8 * B - TAU * rd.turns, ease(s))];
      const l = max(f.pkR * (1 - sm(0, 0.12, s)), 2.2 * u);
      lim(f, l, l, 2.4 * u, 2.4 * u, 2 * u, 2 * u);
      break;
    }
    case 'caught': {
      const c = S.cp, tp = S.psi * 0.8;
      [f.x, f.y, f.ph, f.fs, f.hx, f.hy] = [c.hx + HL * sin(tp), c.hy + HL * cos(tp), -tp, 1, c.hx, c.hy];
      lim(f, 0.4 * sin(S.phc + 0.6), 0.4 * sin(S.phc + 0.6), 0, 0, 0, 0);
      break;
    }
    case 'ret': {
      // A half turn in the air and back to the fly bar, which comes out to meet her.
      const s = cl(f.T / TR, 0, 1), [ex, ey] = barAt(rd.A);
      [f.x, f.y, f.ph, f.fs] = [mix(f.sx, ex + HL * sin(rd.A), s), mix(f.sy, ey + HL * cos(rd.A), s) - 18 * s * (1 - s), mix(f.ph0, -rd.A, s), s < 0.5 ? 1 : -1];
      const a = sin(PI * s);
      f.hx = null;
      lim(f, 0.3 * a, 0.3 * a, 0, 0, 1.3 * a, -1.3 * a);
      if (s >= 1) f.m = 'ride';
      break;
    }
    case 'land': {
      const k = sm(0, 0.35, f.T);
      rest(f);
      [f.x, f.y, f.ph, f.hx, f.hy] = [mix(f.sx, hbx - 1, k), mix(f.sy, BY - LEG, k), mix(f.ph, 0, k), hbx, hby];
      if (f.T > 0.4) f.m = f.next;
      break;
    }
    case 'drop': {
      f.vy += G * d;
      [f.x, f.y] = [f.x + f.vx * d, f.y + f.vy * d];
      const s = cl(f.T / f.TF, 0, 1), u = sm(0.1, 0.3, s) * (1 - sm(0.62, 0.85, s));
      f.ph = mix(f.ph0, -PI / 2 - TAU, ease(s));
      lim(f, 2.2 * u, 2.2 * u, 2.4 * u, 2.4 * u, 0.6 + 1.4 * u, 0.6 + 1.4 * u).hx = null;
      if (f.y >= netY(f.x) - 1) {
        [f.m, f.T, nt.x] = ['net', 0, f.x];
        S.pop = max(S.pop, 0.8);
        burst(S, 6);
      }
      break;
    }
    case 'net': {
      // Bouncing on her back: a stiff spring while she is in the net, a fall while she is out.
      const n = max(1, ceil(d / 0.006)), h = d / n;
      for (let j = 0; j < n; j++) {
        const pen = f.y - (netY(f.x) - 1);
        f.vy += (G - (pen > 0 ? 420 * pen + 7 * f.vy : 0)) * h;
        [f.y, f.x, f.vx] = [f.y + f.vy * h, f.x + f.vx * h, f.vx * (1 - 2.5 * h)];
        if (pen > 0) [nt.s, nt.v] = [pen, f.vy];
        else (nt.v += (-900 * nt.s - 22 * nt.v) * h), (nt.s += nt.v * h);
      }
      [nt.x, nt.hold, f.ph] = [f.x, true, -PI / 2];
      lim(f, 0.6, 0.6, 0.4, 0.4, 1.6 + 0.5 * sin(f.T * 9), 1.6 - 0.5 * sin(f.T * 9));
      if (f.T > 2.6) [f.m, f.T, f.sy] = ['up', 0, f.y];
      break;
    }
    case 'up':
    case 'tada':
    case 'walk': {
      nt.s += (1.5 - nt.s) * min(1, d * 8);
      [nt.v, nt.x, nt.hold] = [0, f.x, true];
      const top = netY(f.x) + nt.s - LEG - 0.6;
      if (f.m === 'up') {
        const k = sm(0, 0.5, f.T);
        rest(f);
        [f.ph, f.y] = [mix(-PI / 2, 0, k), mix(f.sy, top, k)];
        if (f.T > 0.55) [f.m, f.T] = ['tada', 0];
      } else if (f.m === 'tada') {
        // Arms up for the crowd.
        [f.ph, f.y] = [0, top];
        lim(f, 0, 0, 0, 0, 0.55, -0.55);
        if (f.T > 0.8) [f.m, f.T] = ['walk', 0];
      } else {
        // Bouncing along the net to the ladder.
        const w = sin(f.T * 8);
        [f.fs, f.x, f.y, f.ph] = [-1, f.x - 13 * d, top - 1.1 * abs(w), 0];
        lim(f, 0.5 * w, -0.5 * w, 0, 0, PI - 0.5 * w, PI + 0.5 * w);
        if (f.x <= LX) [f.m, f.T] = ['climb', 0];
      }
      break;
    }
    case 'climb': {
      // Up the rope ladder to the board.
      const w = sin(f.T * 9);
      [f.x, f.y, f.fs, f.ph, f.hx] = [LX, f.y - 12 * d, -1, 0, null];
      const p = max(0, w), q = max(0, -w);
      lim(f, 0.9 * p, 0.9 * q, 1.5 * p, 1.5 * q, 0.35 + 0.45 * w, 0.35 - 0.45 * w);
      if (f.y <= BY - LEG) [f.y, f.m] = [BY - LEG, 'wait'];
      break;
    }
  }
  if (d > 0) [f.vx0, f.vy0] = [(f.x - f.px) / d, (f.y - f.py) / d];
  [f.px, f.py] = [f.x, f.y];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], rdt = cl(dt || 0, 0, 0.1), d = rdt * (cl(kv[1], 0.2, 3) / 2);
  const u = cl(kv[0], 0, 1) * 3, pi = min(2, floor(u));
  for (let j = 0; j < 7; j++) for (let c = 0; c < 3; c++) S.P[j][c] = mix(PAL[pi][j][c], PAL[pi + 1][j][c], u - pi);
  [S.turns, S.hz] = [cl(round(kv[2]), 1, 3), 0.26 + 0.74 * cl(kv[3], 0, 1)];
  if (!S.started) {
    // Open mid-act: the first flyer is already out on her first swing.
    [S.started, S.fl[0].m, S.fl[0].T] = [true, 'swing', 1];
    newRound(S, -0.9, 0);
    [S.A, S.phc] = [S.rd.A, S.ct.ph - OM * S.rd.tc];
  }
  const tp = S.t, t = (S.t += d), rd = S.rd;
  if (input.btnPressed && input.btnPressed[0]) {
    // Drum roll: this trick becomes the triple if she has not let go yet, else the next one.
    S.drumB = 1;
    if (!rd.rel && !rd.over) {
      Object.assign(rd, { turns: 3, fin: true, tf: 1.5, h: 17, tc: rd.tr + 1.5 });
      S.nextFin = false;
      if (S.ct && S.ct.ev === 0) S.ct.t = rd.tc;
    } else S.trip = true;
  }
  S.A = S.bar === 'hook' && !rd.over ? mix(rd.A0, rd.A, sm(rd.t0, rd.tg, t)) : rd.A;
  S.th = S.bar === 'hook' ? -S.A : -S.A * cos(OM * (t - rd.tg));
  // The catcher, phase-locked to the next thing he has to be on time for.
  const ct = S.ct, rem = ct ? ct.t - tp : 0;
  S.phc = ct ? (rem <= d ? ct.ph : S.phc + ((ct.ph - S.phc) * d) / rem) : S.phc + OM * d;
  S.cp = cpose((S.psi = -B * cos(S.phc)));
  if (ct && rem <= d) (S.ct = null), catcherEvent(S, ct.ev);
  const nt = S.net, h = min(d, 0.02);
  nt.hold = false;
  S.fl.forEach((f, i) => stepFlyer(S, f, d, i));
  // An empty net rings and settles.
  if (!nt.hold) (nt.v += (-900 * nt.s - 22 * nt.v) * h), (nt.s = (nt.s + nt.v * h) * exp(-d * 3));
  // After a drop the bar swings empty until it comes back to the board and the next flyer hooks it.
  const R = S.rd;
  const w = S.fl.findIndex((f) => f.m === 'wait');
  if (R.over && S.bar === 'free' && w >= 0 && floor((t - R.tg) / PB) > floor((tp - R.tg) / PB)) [S.bar, S.fl[w].m] = ['hook', 'hold'], newRound(S, t + 0.7, w);
  // Light cues: the house dims for the drum roll, more for a bigger trick, and comes up on the catch.
  const r = S.rd, star = S.fl[S.star];
  const roll = (!r.rel && t > r.tg + 0.5 * PB) || star.m === 'fly' || S.drumB > 0 ? 1 : 0;
  S.drum += (roll - S.drum) * (1 - exp(-d * 4));
  S.drumB = max(0, S.drumB - rdt * 0.4);
  S.pop *= exp(-d * 0.9);
  S.wash = (1 - S.drum * (0.3 + 0.22 * (r.turns - 1))) * (1 + 0.8 * S.pop);
  // The follow spots: two on the flyer, the third on the catcher unless the trick is big.
  const fin = S.fl.find((f) => ONNET[f.m]);
  const tg = [fin || star, fin && t < r.tg + 0.4 ? fin : star, S.drum > 0.5 && r.turns >= 2 ? star : { x: S.cp.x, y: S.cp.y + 3 }];
  const k = 1 - exp(-d * 8);
  S.sp.forEach((s, j) => {
    const vx = (s.ax += (tg[j].x - s.ax) * k) - s.sx, vy = (s.ay += (tg[j].y - 1 - s.ay) * k) - s.sy, D = (s.D = sqrt(vx * vx + vy * vy));
    [s.ux, s.uy] = [vx / D, vy / D];
  });
  // Camera flashes in the crowd.
  if (rnd() < rdt * 0.9) burst(S, 1);
  for (const e of S.fx) e.a -= rdt * 9;
  S.fx = S.fx.filter((e) => e.a > 0);
}

// A stroke lit by the light field, with optional sequin sparkle.
function seg(S, ax, ay, bx, by, r, c, sp) {
  const { F, LT } = S, dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1e-6;
  const x1 = min(W - 1, ceil(max(ax, bx) + r + 1)), y1 = min(H - 1, ceil(max(ay, by) + r + 1));
  for (let y = max(0, floor(min(ay, by) - r - 1)); y <= y1; y++)
    for (let x = max(0, floor(min(ax, bx) - r - 1)); x <= x1; x++) {
      const t = cl(((x - ax) * dx + (y - ay) * dy) / ll, 0, 1), ex = x - ax - dx * t, ey = y - ay - dy * t;
      const a = cl(r + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (a <= 0) continue;
      const q = (y * W + x) * 3, s = sp ? 0.72 + 0.56 * rnd() : 1;
      for (let j = 0; j < 3; j++) F[q + j] += (c[j] * LT[q + j] * s - F[q + j]) * a;
    }
}

function glow(F, x, y, r, c, k) {
  for (let yy = max(0, floor(y - r)); yy <= min(H - 1, ceil(y + r)); yy++)
    for (let xx = max(0, floor(x - r)); xx <= min(W - 1, ceil(x + r)); xx++) {
      const g = k * exp(-((xx - x) ** 2 + (yy - y) ** 2) / (0.25 * r * r)), q = (yy * W + xx) * 3;
      for (let j = 0; j < 3; j++) F[q + j] += c[j] * g;
    }
}

// A stick figure: hips at (x, y), body angle ph (0 is head up), facing fs.
function fig(S, f, col) {
  const bx = sin(f.ph), by = -cos(f.ph), nx = cos(f.ph) * f.fs, ny = sin(f.ph) * f.fs;
  const dv = (a, l) => [(bx * cos(a) + nx * sin(a)) * l, (by * cos(a) + ny * sin(a)) * l];
  const shx = f.x + bx * 3, shy = f.y + by * 3;
  for (const [l, k] of [[f.l1, f.k1], [f.l2, f.k2]]) {
    const [kx, ky] = dv(PI - l, 1.9), [fx, fy] = dv(PI - l + k, 1.9);
    seg(S, f.x, f.y, f.x + kx, f.y + ky, 0.6, col, 1);
    seg(S, f.x + kx, f.y + ky, f.x + kx + fx, f.y + ky + fy, 0.5, col, 1);
  }
  seg(S, f.x, f.y, shx, shy, 0.8, col, 1);
  for (const a of [f.a1, f.a2]) {
    const [ax, ay] = dv(a, 2.7);
    seg(S, shx, shy, f.hx === null ? shx + ax : f.hx, f.hx === null ? shy + ay : f.hy, 0.42, SKIN, 0);
  }
  seg(S, shx + bx * 1.45, shy + by * 1.45, shx + bx * 1.55, shy + by * 1.55, 0.75, SKIN, 0);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { F, LT, CA, CI, AUD, ROW, POOL, P, wash, hz } = S, wc = P[0];
  const hzA = hz * (0.7 - 0.22 * hz), halo = hz * hz * 0.18, hl = log(max(1, halo * 400));
  const am = wc.map((v) => v * (0.12 + 0.12 * wash)), kc = 0.48 * 255 * wash, air = 9 * hz * wash;
  const sp = S.sp.map((s, j) => [s.sx, s.sy, s.ux, s.uy, s.D, ...P[1 + j].map((v) => v / 255)]);
  for (let y = 0; y < H; y++) {
    // The ring below the net glows in the house light behind the crowd.
    const pb = POOL[y], ring = 50 * sm(117, 104, y) * sm(100, 104, y) * wash + air;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, q = i * 3, ci = CI[i] * kc;
      let r = 4 + wc[0] * ring + CA[q] * wc[0] * ci, g = 4 + wc[1] * ring + CA[q + 1] * wc[1] * ci, b = 9 + wc[2] * ring + CA[q + 2] * wc[2] * ci;
      let lr = 0, lg = 0, lb = 0;
      const cv = CI[i] > 0.02 ? 0.9 * pb * sm(0, 0.3, CI[i]) * 255 : 0;
      for (const s of sp) {
        const vx = x - s[0], vy = y - s[1], al = vx * s[2] + vy * s[3], pp = abs(vx * s[3] - vy * s[2]), R = 0.8 + al * TA;
        if (pp < R) {
          // Lit air along the beam, and past the flyer a pool where it lands on the canvas.
          const p = sm(R, R * 0.45, pp), k = ((p * (al > s[4] ? 0.8 : 1) * 1.3) / (1 + (al / 110) ** 2)) * hzA * 255, c = cv > 0 && al > s[4] ? cv * p : 0;
          (lr += s[5] * p), (lg += s[6] * p), (lb += s[7] * p);
          (r += s[5] * (k + CA[q] * c)), (g += s[6] * (k + CA[q + 1] * c)), (b += s[7] * (k + CA[q + 2] * c));
        }
        // Haze scatters a wide glow round each beam.
        if (pp < (R + 9) * hl) {
          const h = halo * exp(-pp / (R + 9)) * 255;
          (r += s[5] * h), (g += s[6] * h), (b += s[7] * h);
        }
      }
      (F[q] = r), (F[q + 1] = g), (F[q + 2] = b);
      (LT[q] = min(1.25, lr * 1.2 + am[0])), (LT[q + 1] = min(1.25, lg * 1.2 + am[1])), (LT[q + 2] = min(1.25, lb * 1.2 + am[2]));
    }
  }
  const t = S.t;
  // The king pole, the ring of bulbs round the peak, which chase in a drum roll, and the bale ring.
  seg(S, 32, 7, 32, 29, 0.7, STEEL, 0);
  for (let j = 0; j < 22; j++) {
    const a = (TAU * j) / 22, x = 32 + 20 * sin(a), y = 6.5 + 5 * cos(a), ch = (((j / 22 - t * 0.9) % 1) + 1) % 1 < 0.22 ? 1 : 0;
    const v = (mix(0.75 + 0.15 * sin(t * 3 + j * 2.1), 0.3 + 0.9 * ch, S.drum) + 0.5 * S.pop) * (0.85 + 0.15 * cos(a));
    glow(F, x, y, 3.2, [255, 196, 110], 0.42 * v);
    const q = (round(y) * W + round(x)) * 3;
    for (let k = 0; k < 3; k++) F[q + k] += [200, 160, 90][k] * v;
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
  seg(S, 0, BY + 0.6, barAt(-S.rd.A)[0] + 0.4, BY + 0.6, 0.55, [190, 160, 120], 0);
  seg(S, 1, BY + 1, 1, 97, 0.3, ROPE, 0);
  seg(S, 4.2, BY + 1, 4.2, 97, 0.3, ROPE, 0);
  for (let y = BY + 3; y < 97; y += 3) seg(S, 1, y, 4.2, y, 0.25, ROPE, 0);
  // The safety net, a sagging diamond mesh, dented where a flyer is in it.
  const nt = S.net;
  for (let x = 0; x < W; x++) {
    const dn = nt.s * exp(-(((x - nt.x) / 8) ** 2)), far = 94.5 + 1.2 * sin((PI * x) / 63) + 0.6 * dn, near = 103 + 2 * sin((PI * x) / 63) + dn;
    for (let y = max(0, floor(far - 1)); y <= min(H - 1, ceil(near + 1)); y++) {
      const v = (y - far) / (near - far), fa = x * 0.34 + v * 3, fb = x * 0.34 - v * 3;
      let ln = v > -0.06 && v < 1.06 ? max(sm(0.3, 0.48, abs((fa % 1) - 0.5)), sm(0.3, 0.48, abs((((fb % 1) + 1) % 1) - 0.5))) : 0;
      ln = max(ln, sm(0.9, 0.2, abs(y - far)), sm(0.9, 0.2, abs(y - near))) * 0.8;
      const q = (y * W + x) * 3;
      if (ln > 0) for (let j = 0; j < 3; j++) F[q + j] += ([205, 196, 176][j] * LT[q + j] - F[q + j]) * ln;
    }
  }
  // The fly bar on its ropes, the catcher's cradle, the catcher and the flyers.
  const [bx, by] = barAt(S.th), c = S.cp;
  for (const [px, py, x, y] of [[PFX, PFY, bx, by], [PCX, PCY, c.bx, c.by]]) {
    seg(S, px - 1.2, py, x - 1.2, y, 0.28, ROPE, 0);
    seg(S, px + 1.2, py, x + 1.2, y, 0.28, ROPE, 0);
    seg(S, x - 1.8, y, x + 1.8, y, 0.45, BAR, 0);
  }
  fig(S, c, P[6]);
  for (const f of S.fl) fig(S, f, P[f.c]);
  // The crowd in front of it all, a dark sea, each head rimmed by the light behind it.
  for (let i = W; i < N; i++) {
    const a = AUD[i];
    if (a <= 0) continue;
    const q = i * 3, k = ROW[i], rim = k > ROW[i - W] ? (1 - 0.2 * k) * a : 0;
    for (let j = 0; j < 3; j++) F[q + j] += ((12 - 2.5 * k) * wc[j] - F[q + j]) * a + rim * (16 * wash * wc[j] + 60 * max(0, LT[q + j] - 0.3));
  }
  // Phones held up to film, and camera flashes.
  for (const [x, y] of S.phones) if (x >= 0 && x < W - 1) for (let j = 0; j < 6; j++) F[(y * W + x) * 3 + j] += [70, 92, 130][j % 3];
  for (const e of S.fx) glow(F, e.x, e.y, 2.2, [255, 250, 240], e.a * e.a * (1 - e.w));
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
