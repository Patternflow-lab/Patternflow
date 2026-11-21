// ===== Patternflow pattern =====
// Title:   Relay
// Family:  network
// Idea:    A sparse mesh of ring-shaped stations joined to their near neighbours covers the dark panel, and bright messages run along its links from station to station by the shortest way to a far one, each trailing its colour over the links it used, while the stations drift so that links break, new ones form and the messages go round another way.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: mesh networks: a Gabriel graph of drifting stations, messages routed hop by hop on shortest paths
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..3, Stations=-1..1, Traffic=0..1
//
// Knob 1: Hue. The base tone of the mesh, from cyan-blue where the knob opens round the wheel; the message colours keep their steps from it.
// Knob 2: Speed. How fast the messages run and the stations drift. At the bottom everything holds still; where it opens a message runs about 45 LEDs a second.
// Knob 3: Stations. How many stations the mesh has: 8 at the bottom, 16 where the knob opens, 30 at the top. The others move over to make room.
// Knob 4: Traffic. How many messages are on their way at once, from 2 at the bottom through 3 where the knob opens to 16 at the top. The more there are, the shorter the trail each one keeps.

const W = 64;
const H = 128;
// Most stations and most messages.
const MOST = 30;
const MSGS = 16;
// How fast a message runs at Speed 1, in LEDs a second, and how long the bright tail behind its head is.
const RUN = 22.5;
const TAIL = 9.5;
// The message colours, as steps round the wheel from the base tone.
const STEPS = [0.54, 0.18, 0.72, 0.36];
// How long a link keeps the colour of a message with three of them about, in seconds at Speed 1,
// and how bright that colour is at its old end and just behind the message.
const KEEP = 4;
const DIM = 0.34;
const FRESH = 0.6;
// How long the ring at a destination lasts, how long a new message charges up before it leaves,
// and how long a station stays filled after a message has passed.
const FLASH = 0.9;
const CHARGE = 0.6;
const FILL = 0.7;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[o + 1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[o + 2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

const pair = (i, j) => (i < j ? i * MOST + j : j * MOST + i);
const span = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

export function setup(params) {
  params.t = 0;
  params.started = false;
  params.next = 0;
  params.keep = KEEP;
  params.size = 22;
  params.stations = Array.from({ length: MOST }, () => ({
    // Where it rests, where it is now, how much room it asks for and how far it keeps from the edge.
    hx: 6 + Math.random() * (W - 12),
    hy: 6 + Math.random() * (H - 12),
    x: 0,
    y: 0,
    room: 0.85 + 0.3 * Math.random(),
    shy: 0.3 + 0.75 * Math.random(),
    // It wanders round its resting place on four sines whose frequencies share no divisor.
    f: [0.071 + 0.09 * Math.random(), 0.173 + 0.11 * Math.random(), 0.067 + 0.09 * Math.random(), 0.181 + 0.11 * Math.random()],
    p: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
    live: false,
    a: 0,
    // The colour of the last message through it, how much of that colour is left and how full its middle is.
    tint: 0,
    heat: 0,
    fill: 0,
    mark: -1,
  }));
  // For each pair of stations: how far its link has faded in, whether it should be there and whether a message is on it.
  params.link = new Float32Array(MOST * MOST);
  params.up = new Uint8Array(MOST * MOST);
  params.busy = new Uint8Array(MOST * MOST);
  // And the last message along it: when it went in, at which end, how far it has got, its colour and which message it is.
  params.stamp = new Float64Array(MOST * MOST).fill(-1e9);
  params.back = new Uint8Array(MOST * MOST);
  params.prog = new Float32Array(MOST * MOST);
  params.tint = new Uint8Array(MOST * MOST);
  params.owner = new Uint8Array(MOST * MOST);
  params.far = new Float32Array(MOST);
  params.done = new Uint8Array(MOST);
  // state: 0 resting, 1 charging at its source, 2 on a link, 3 waiting for a route.
  params.msgs = Array.from({ length: MSGS }, (_, i) => ({ state: 0, wait: 0.2 + 0.55 * i, at: 0, from: 0, to: 0, prev: -1, dest: 0, u: 0, c: 0 }));
  params.flashes = [];
  params.buf = new Float32Array(W * H * 3);
  params.pal = new Float32Array(STEPS.length * 3);
  params.lift = new Float32Array(STEPS.length);
  params.base = new Float32Array(6);
  params.ca = new Float32Array(4);
  params.cb = new Float32Array(4);
}

// A place for a new station: of some random spots, the one furthest from the stations that are there.
function hole(params, s) {
  let best = -1;
  for (let k = 0; k < 24; k++) {
    const x = 6 + Math.random() * (W - 12);
    const y = 6 + Math.random() * (H - 12);
    let near = 1e9;
    for (const o of params.stations) {
      if (!o.live) continue;
      const d = (o.hx - x) * (o.hx - x) + (o.hy - y) * (o.hy - y);
      if (d < near) near = d;
    }
    if (near > best) {
      best = near;
      s.hx = x;
      s.hy = y;
    }
  }
}

// The stations push each other and the walls away until each has its room, so any number of them covers the panel evenly.
function settle(params, n, rdt) {
  const st = params.stations;
  const size = Math.sqrt((W * H) / n);
  params.size = size;
  const push = Math.min(0.5, 8 * rdt);
  for (let i = 0; i < MOST; i++) {
    const a = st[i];
    if (!a.live) continue;
    const ra = 0.6 * size * a.room;
    for (let j = i + 1; j < MOST; j++) {
      const b = st[j];
      if (!b.live) continue;
      const dx = b.hx - a.hx;
      const dy = b.hy - a.hy;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      const over = ra + 0.6 * size * b.room - d;
      if (over <= 0) continue;
      const m = (0.5 * push * over) / d;
      a.hx -= dx * m;
      a.hy -= dy * m;
      b.hx += dx * m;
      b.hy += dy * m;
    }
    const wall = a.shy * ra;
    if (a.hx < wall) a.hx += push * (wall - a.hx);
    if (a.hx > W - wall) a.hx -= push * (a.hx - (W - wall));
    if (a.hy < wall) a.hy += push * (wall - a.hy);
    if (a.hy > H - wall) a.hy -= push * (a.hy - (H - wall));
    a.hx = clamp(a.hx, 4, W - 4);
    a.hy = clamp(a.hy, 4, H - 4);
  }
  // Where each station is now: its resting place and its wandering, held off the edge.
  const amp = clamp(0.34 * size, 4.5, 9);
  const t = params.t;
  for (const s of st) {
    const ax = Math.max(0, Math.min(amp, s.hx - 4.5, W - 4.5 - s.hx));
    const ay = Math.max(0, Math.min(amp, s.hy - 4.5, H - 4.5 - s.hy));
    s.x = s.hx + (ax * (Math.sin(s.f[0] * t + s.p[0]) + 0.6 * Math.sin(s.f[1] * t + s.p[1]))) / 1.6;
    s.y = s.hy + (ay * (Math.sin(s.f[2] * t + s.p[2]) + 0.6 * Math.sin(s.f[3] * t + s.p[3]))) / 1.6;
  }
  // Two that wander into each other are held apart.
  const least = 0.5 * size;
  for (let i = 0; i < MOST; i++)
    for (let j = i + 1; j < MOST; j++) {
      const a = st[i];
      const b = st[j];
      if (!a.live || !b.live) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      if (d >= least) continue;
      const m = (0.5 * (least - d)) / d;
      a.x = clamp(a.x - dx * m, 3.5, W - 3.5);
      a.y = clamp(a.y - dy * m, 3.5, H - 3.5);
      b.x = clamp(b.x + dx * m, 3.5, W - 3.5);
      b.y = clamp(b.y + dy * m, 3.5, H - 3.5);
    }
}

// The Gabriel graph: two stations are joined when no third lies inside the circle that has the line between them as its diameter.
function join(params, rdt) {
  const st = params.stations;
  const { link, up, busy } = params;
  const step = rdt / 0.4;
  for (let i = 0; i < MOST; i++)
    for (let j = i + 1; j < MOST; j++) {
      const p = i * MOST + j;
      let want = 0;
      if (st[i].live && st[j].live) {
        const mx = (st[i].x + st[j].x) / 2;
        const my = (st[i].y + st[j].y) / 2;
        const dx = st[i].x - mx;
        const dy = st[i].y - my;
        // A link that is up takes a little more to break than it took to form.
        const r2 = (dx * dx + dy * dy) * (up[p] ? 0.94 : 1);
        want = 1;
        for (let k = 0; k < MOST; k++) {
          if (k === i || k === j || !st[k].live) continue;
          const ex = st[k].x - mx;
          const ey = st[k].y - my;
          if (ex * ex + ey * ey < r2) {
            want = 0;
            break;
          }
        }
      }
      up[p] = want;
      // A link with a message on it stays until the message is across.
      const goal = want || busy[p] ? 1 : 0;
      link[p] = clamp(link[p] + clamp(goal - link[p], -step, step), 0, 1);
    }
}

const open = (params, i, j) => {
  const p = pair(i, j);
  return params.up[p] && params.link[p] > 0.5;
};

// The next station on the shortest way from one station to another over the links that are up now, or -1.
function route(params, at, dest) {
  const st = params.stations;
  const { far, done } = params;
  far.fill(1e9);
  done.fill(0);
  far[dest] = 0;
  for (let n = 0; n < MOST; n++) {
    let c = -1;
    for (let i = 0; i < MOST; i++) if (!done[i] && far[i] < 1e9 && (c < 0 || far[i] < far[c])) c = i;
    if (c < 0) break;
    done[c] = 1;
    for (let i = 0; i < MOST; i++) {
      if (done[i] || !st[i].live || !open(params, c, i)) continue;
      const d = far[c] + span(st[c], st[i]);
      if (d < far[i]) far[i] = d;
    }
  }
  let best = -1;
  let least = 1e9;
  for (let i = 0; i < MOST; i++) {
    if (i === at || !st[i].live || far[i] >= 1e9 || !open(params, at, i)) continue;
    const d = far[i] + span(st[at], st[i]);
    if (d < least) {
      least = d;
      best = i;
    }
  }
  return best;
}

// One of the n live stations, and one of them far from a given station.
const pick = (n) => Math.min(n - 1, Math.floor(Math.random() * n));

function distant(params, n, from) {
  const st = params.stations;
  let most = 0;
  for (let i = 0; i < n; i++) most = Math.max(most, span(st[i], st[from]));
  for (let tries = 0; tries < 40; tries++) {
    const i = pick(n);
    if (i !== from && span(st[i], st[from]) > 0.55 * most) return i;
  }
  return (from + 1) % n;
}

// Message k leaves the station it is at for the next one on its way, if there is a way.
function hop(params, k, n) {
  const m = params.msgs[k];
  if (!params.stations[m.dest].live || m.dest === m.at) m.dest = distant(params, n, m.at);
  const to = route(params, m.at, m.dest);
  if (to < 0) {
    m.state = 3;
    m.wait = 0.4;
    return;
  }
  m.prev = m.state === 2 ? m.from : -1;
  m.from = m.at;
  m.to = to;
  m.u = 0;
  m.state = 2;
  const p = pair(m.from, to);
  params.stamp[p] = params.t;
  params.back[p] = m.from > to ? 1 : 0;
  params.prog[p] = 0;
  params.tint[p] = m.c;
  params.owner[p] = k + 1;
}

function traffic(params, n, count, sdt) {
  const st = params.stations;
  const { msgs, busy, prog, owner } = params;
  busy.fill(0);
  for (let k = 0; k < MSGS; k++) {
    const m = msgs[k];
    if (m.state === 0) {
      m.wait -= sdt;
      if (m.wait > 0 || k >= count) continue;
      // A new message: a colour, a source and a destination far from it.
      m.c = params.next++ % STEPS.length;
      m.at = pick(n);
      m.dest = distant(params, n, m.at);
      m.state = 1;
      m.wait = CHARGE;
    } else if (m.state === 1 || m.state === 3) {
      const s = st[m.at];
      if (!s.live) {
        m.state = 0;
        m.wait = 0.3;
        continue;
      }
      m.wait -= sdt;
      if (m.state === 1) {
        s.tint = m.c;
        s.heat = 1;
        s.fill = Math.max(s.fill, 1 - m.wait / CHARGE);
      }
      if (m.wait <= 0) hop(params, k, n);
    } else {
      const p = pair(m.from, m.to);
      m.u += (RUN * sdt) / Math.max(2, span(st[m.from], st[m.to]));
      if (owner[p] === k + 1) prog[p] = Math.min(1, m.u);
      if (m.u >= 1) {
        const s = st[m.to];
        if (!s.live) {
          m.state = 0;
          m.wait = 0.3;
          continue;
        }
        s.tint = m.c;
        s.heat = 1;
        s.fill = 1;
        m.at = m.to;
        if (m.to === m.dest) {
          params.flashes.push({ i: m.to, c: m.c, age: 0 });
          m.state = 0;
          m.wait = 0.5 + Math.random();
        } else hop(params, k, n);
      }
    }
    if (m.state === 2) busy[pair(m.from, m.to)] = 1;
  }
}

function step(params, n, count, rdt, sdt) {
  const st = params.stations;
  // With more messages about each keeps a shorter trail, so the mesh still shows between them.
  params.keep = KEEP * Math.sqrt(3 / count);
  for (let i = 0; i < MOST; i++) {
    const s = st[i];
    const want = i < n;
    if (want && !s.live) {
      if (s.a <= 0) hole(params, s);
      s.live = true;
    } else if (!want) s.live = false;
    s.a = clamp(s.a + (want ? rdt : -rdt) / 0.4, 0, 1);
    s.heat = Math.max(0, s.heat - sdt / params.keep);
    s.fill = Math.max(0, s.fill - sdt / FILL);
  }
  params.t += sdt;
  settle(params, n, rdt);
  join(params, rdt);
  traffic(params, n, count, sdt);
  for (const f of params.flashes) f.age += sdt / FLASH;
  params.flashes = params.flashes.filter((f) => f.age < 1);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const speed = clamp(k[1], 0, 3);
  const u = clamp(k[2], -1, 1);
  const n = Math.round(u < 0 ? 16 + 8 * u : 16 + 14 * u);
  const count = Math.round(2 + 14 * clamp(k[3], 0, 1));
  params.hue = k[0] + 0.55;
  // The mesh has settled and has been carrying messages for a while when the panel opens.
  if (!params.started) {
    params.started = true;
    for (let i = 0; i < MOST; i++) params.stations[i].live = i < n;
    for (let i = 0; i < 500; i++) settle(params, n, 1 / 30);
    for (let i = 0; i < 12; i++) join(params, 1);
    for (let i = 0; i < 180; i++) step(params, n, count, 1 / 15, 1 / 15);
  }
  step(params, n, count, dt, dt * speed);
}

function rgba(out, r, g, b, a) {
  out[0] = r;
  out[1] = g;
  out[2] = b;
  out[3] = a;
}

// A line from one point to another. Its half width, its colour and its strength run evenly from one end to the other.
function line(buf, x0, y0, x1, y1, h0, h1, c0, c1) {
  const reach = Math.max(h0, h1) + 1;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - reach));
  const xb = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + reach));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - reach));
  const yb = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + reach));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy + 1e-6;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - x0;
      const qy = y + 0.5 - y0;
      const t = clamp((qx * dx + qy * dy) / l2, 0, 1);
      const ex = qx - t * dx;
      const ey = qy - t * dy;
      const c = clamp(h0 + (h1 - h0) * t + 0.5 - Math.sqrt(ex * ex + ey * ey), 0, 1) * (c0[3] + (c1[3] - c0[3]) * t);
      if (c <= 0) continue;
      const j = (y * W + x) * 3;
      buf[j] += (c0[0] + (c1[0] - c0[0]) * t - buf[j]) * c;
      buf[j + 1] += (c0[1] + (c1[1] - c0[1]) * t - buf[j + 1]) * c;
      buf[j + 2] += (c0[2] + (c1[2] - c0[2]) * t - buf[j + 2]) * c;
    }
}

// A ring of radius rad and half width half; with rad 0 it is a disc.
function ring(buf, cx, cy, rad, half, r, g, b, a) {
  const reach = rad + half + 1;
  const xa = Math.max(0, Math.floor(cx - reach));
  const xb = Math.min(W - 1, Math.ceil(cx + reach));
  const ya = Math.max(0, Math.floor(cy - reach));
  const yb = Math.min(H - 1, Math.ceil(cy + reach));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const ex = x + 0.5 - cx;
      const ey = y + 0.5 - cy;
      const c = clamp(half + 0.5 - Math.abs(Math.sqrt(ex * ex + ey * ey) - rad), 0, 1) * a;
      if (c <= 0) continue;
      const j = (y * W + x) * 3;
      buf[j] += (r - buf[j]) * c;
      buf[j + 1] += (g - buf[j + 1]) * c;
      buf[j + 2] += (b - buf[j + 2]) * c;
    }
}

export function draw(display, params) {
  const { buf, pal, lift, base, link, stamp, back, prog, tint, msgs, ca, cb, keep, t } = params;
  const st = params.stations;
  buf.fill(0);
  for (let c = 0; c < STEPS.length; c++) {
    hsv(params.hue + STEPS[c], 0.92, 1, pal, c * 3);
    // Blue, violet and red are dark colours at the same strength, so their trails get more of it.
    lift[c] = 1 + 3.2 * Math.max(0, 0.46 - 0.3 * pal[c * 3] - 0.59 * pal[c * 3 + 1] - 0.11 * pal[c * 3 + 2]);
  }
  // The base tone. Orange and yellow go brown when they are dim, so they get more light.
  const warm = Math.max(0, Math.cos(6.283 * (params.hue - 0.11)));
  hsv(params.hue, 0.66, 0.4 + 0.12 * warm * warm, base, 0);
  hsv(params.hue, 0.5, 0.7, base, 3);
  // Links and stations are drawn a little finer when there are many.
  const wide = clamp(0.05 * params.size, 0.92, 1.12);
  const rad = clamp(0.088 * params.size, 1.6, 2.2);

  // The links in the base tone, and over each the trail of the last message along it:
  // brightest just behind the message, and taken up from the far end once it is old.
  for (let i = 0; i < MOST; i++)
    for (let j = i + 1; j < MOST; j++) {
      const p = i * MOST + j;
      const a = link[p] * st[i].a * st[j].a;
      if (a < 0.01) continue;
      rgba(ca, base[0], base[1], base[2], a);
      line(buf, st[i].x, st[i].y, st[j].x, st[j].y, wide, wide, ca, ca);
      const since = t - stamp[p];
      const cross = Math.max(2, span(st[i], st[j])) / RUN;
      const tail = clamp((since - keep) / cross, 0, 1);
      const head = prog[p];
      if (head <= tail) continue;
      const from = back[p] ? st[j] : st[i];
      const to = back[p] ? st[i] : st[j];
      const c = tint[p] * 3;
      const v0 = Math.min(0.9, (DIM + (FRESH - DIM) * clamp(1 - (since - tail * cross) / keep, 0, 1)) * lift[tint[p]]);
      const v1 = Math.min(0.9, (DIM + (FRESH - DIM) * clamp(1 - (since - head * cross) / keep, 0, 1)) * lift[tint[p]]);
      rgba(ca, pal[c] * v0, pal[c + 1] * v0, pal[c + 2] * v0, a);
      rgba(cb, pal[c] * v1, pal[c + 1] * v1, pal[c + 2] * v1, a);
      line(buf, from.x + (to.x - from.x) * tail, from.y + (to.y - from.y) * tail, from.x + (to.x - from.x) * head, from.y + (to.y - from.y) * head, wide, wide, ca, cb);
    }

  // The stations: rings, dark in the middle, that fill with the colour of a message passing through.
  for (const s of st) s.mark = -1;
  for (const m of msgs) if (m.state !== 0) st[m.dest].mark = m.c;
  for (let i = 0; i < MOST; i++) {
    const s = st[i];
    if (s.a < 0.01) continue;
    const c = s.tint * 3;
    const w = clamp(s.heat / 0.12, 0, 1);
    const v = 0.72 + 0.28 * s.heat;
    let r = base[3] + (pal[c] * v - base[3]) * w;
    let g = base[4] + (pal[c + 1] * v - base[4]) * w;
    let b = base[5] + (pal[c + 2] * v - base[5]) * w;
    // A station a message is on its way to wears that colour and breathes.
    if (s.mark >= 0 && w < 0.5) {
      const d = s.mark * 3;
      const k = 0.74 + 0.2 * Math.sin(t * 3.1 + i);
      r = pal[d] * k;
      g = pal[d + 1] * k;
      b = pal[d + 2] * k;
    }
    ring(buf, s.x, s.y, 0, rad + 0.3, 0, 0, 0, s.a);
    ring(buf, s.x, s.y, rad, 0.85, r, g, b, s.a);
    if (s.fill > 0) ring(buf, s.x, s.y, 0, rad - 0.7, r + (1 - r) * 0.45, g + (1 - g) * 0.45, b + (1 - b) * 0.45, s.a * clamp(s.fill * 2.5, 0, 1));
  }

  for (const m of msgs) {
    const c = m.c * 3;
    if (m.state === 3) {
      // No route: it waits at its station, pulsing.
      const s = st[m.at];
      ring(buf, s.x, s.y, rad + 2.7, 0.8, pal[c], pal[c + 1], pal[c + 2], 0.45 + 0.3 * Math.sin(t * 9));
    }
    if (m.state !== 2) continue;
    // The pulse: a bright tail in the message colour back along the way it came, and a head near white.
    const a = st[m.from];
    const b = st[m.to];
    const len = span(a, b);
    const hx = a.x + (b.x - a.x) * m.u;
    const hy = a.y + (b.y - a.y) * m.u;
    const gone = Math.min(TAIL, m.u * len);
    const tu = m.u - gone / Math.max(len, 1e-3);
    rgba(ca, pal[c], pal[c + 1], pal[c + 2], 1);
    rgba(cb, pal[c], pal[c + 1], pal[c + 2], 1 - gone / TAIL);
    line(buf, hx, hy, a.x + (b.x - a.x) * tu, a.y + (b.y - a.y) * tu, 1.7, 1.7 - 0.7 * (gone / TAIL), ca, cb);
    if (gone < TAIL && m.prev >= 0) {
      const q = st[m.prev];
      const rest = Math.min(TAIL - gone, span(q, a));
      const f = rest / Math.max(span(q, a), 1e-3);
      rgba(ca, pal[c], pal[c + 1], pal[c + 2], 1 - gone / TAIL);
      rgba(cb, pal[c], pal[c + 1], pal[c + 2], 1 - (gone + rest) / TAIL);
      line(buf, a.x, a.y, a.x + (q.x - a.x) * f, a.y + (q.y - a.y) * f, 1.7 - 0.7 * (gone / TAIL), 1.7 - 0.7 * ((gone + rest) / TAIL), ca, cb);
    }
    ring(buf, hx, hy, 0, 2, 0.5 + 0.5 * pal[c], 0.5 + 0.5 * pal[c + 1], 0.5 + 0.5 * pal[c + 2], 1);
    ring(buf, hx, hy, 0, 1.1, 1, 1, 1, 1);
  }

  // A message that has arrived: a ring opens out from its destination and fades.
  for (const f of params.flashes) {
    const s = st[f.i];
    const c = f.c * 3;
    const e = 1 - (1 - f.age) * (1 - f.age);
    const w = (1 - f.age) * 0.5;
    ring(buf, s.x, s.y, rad + 1.2 + 8 * e, 1, pal[c] + (1 - pal[c]) * w, pal[c + 1] + (1 - pal[c + 1]) * w, pal[c + 2] + (1 - pal[c + 2]) * w, s.a * Math.pow(1 - f.age, 1.3));
  }

  for (let y = 0, j = 0; y < H; y++)
    for (let x = 0; x < W; x++, j += 3) display.setPixel(x, y, clamp(buf[j] * 255, 0, 255), clamp(buf[j + 1] * 255, 0, 255), clamp(buf[j + 2] * 255, 0, 255));
}
