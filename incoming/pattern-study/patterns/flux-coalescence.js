// ===== Patternflow pattern =====
// Title:   Flux Coalescence
// Family:  reconnection
// Idea:    Seen from above, a dozen parallel current filaments of both signs drift, spiral and coalesce, and the field lines around them, drawn as contour lines of the flux function, pinch at the X-point between two like filaments and reconnect into one set of rings around the merged one while new opposite pairs tear out of the dark and push apart.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: coalescence of parallel current filaments, the coalescence instability of magnetic islands (Finn and Kaw, 1977, from memory); reconnection at an X-point (Parker 1957, Sweet 1958, from memory); the flux function of line currents, whose contours are the field lines; the pair force, the spiral, the current decay and the tearing births are a toy model and original, pattern round 247
// Round:   247
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..4, Filaments=-1..1, Lines=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel and opens on pale gold for positive current, pale cyan for negative, with white where the two meet. The separatrix at an X-point and the ring a merger throws out stay near white at every hue.
// Knob 2: Speed. 0.4 to 4, opening at 2: the clock of the filaments, which is also the clock of the merges. At 0.4 they creep and one merger takes about half a minute, while the guide field still turns; at 2 a merger comes every few seconds; at 4 they rush, spiral and fuse in a second or two.
// Knob 3: Filaments. -1 to 1, opening at 0: how many filaments the panel keeps alive, about 5 at -1, 10 at 0 and 16 at 1. Few filaments leave wide quiet rings and clear X-points; many leave a field of small cores, where mergers come close together.
// Knob 4: Lines. -1 to 1, opening at 0.06: how many field lines are drawn. At -1 about three bold rings surround each filament and the far field has a line every 30 LED or so; at 1 the contour step is a third as large, the rings crowd, and the lines melt into the glow of a core where they would lie closer than 3 LED.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, log, tanh, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const DEF = [0, 2, 0, 0.06];

// ---- the model ---------------------------------------------------------------
const A0 = 2.4;                 // core size of a filament in LED; the flux is I ln(r^2 + A0^2)
const A2 = A0 * A0;
const L0 = log(28 * 28);        // flux is counted from a ring 28 LED out, so a hill of positive flux sits round each positive filament
const KF = 11;                  // pair force: k I1 I2 / r, in LED per s^2 for I = 1 at r = 1
const KP = 0.42;                // share of that force that turns the pair round each other
const RS = 22;                  // the pull is screened beyond about 22 LED, so like signs gather in small groups and the panel does not split into one positive half and one negative half
const SOFT2 = 9;                // the force stops growing inside 3 LED
const GAMMA = 1.0;              // viscous damping, 1/s
const KICK = 2.2;               // random push, LED/s per root second
const KC = 0.9;                 // the pull to the middle of the panel, LED/s^2 at the edge
const MERGE_R2 = (2.5 * A0) * (2.5 * A0);
const TM = 0.26;                // s for a merging pair to close by a factor e
const IMAX = 3;
const TAU = 80;                 // s for a filament of strength 1 to lose most of its current
const IDIE = 0.4;
const NHARD = 26;

const mk = (x, y, vx, vy, I, life) => ({ x, y, vx, vy, I, life, kill: 0, ie: 0, ax: 0, ay: 0, mg: false });
const ease = (t) => t * t * (3 - 2 * t);

function alive(st) {
  let n = 0;
  for (const f of st.f) if (f.kill === 0) n++;
  return n;
}

// a place away from the others: the best of eight tries
function site(st) {
  let bx = 32, by = 64, bd = -1;
  for (let c = 0; c < 8; c++) {
    const x = 11 + rnd() * 42, y = 14 + rnd() * 100;
    let md = 1e9;
    for (const f of st.f) md = min(md, (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y));
    if (md > bd) (bd = md), (bx = x), (by = y);
  }
  return [bx, by];
}

function ring(st, x, y, amp) {
  st.rings.push({ x, y, age: 0, amp });
}

// a current sheet tears: two small filaments of opposite sign start close together and push apart
function tear(st, net) {
  const [x, y] = site(st);
  const s = 0.9 + 0.6 * rnd();
  if (abs(net) > 1.4) {
    // net current has wandered off zero: only the missing sign is born
    const a = rnd() * 2 * PI;
    st.f.push(mk(x, y, cos(a) * 3, sin(a) * 3, -Math.sign(net) * min(1.6, 0.8 + 0.4 * abs(net)), 0));
  } else {
    const a = rnd() * 2 * PI, ux = cos(a), uy = sin(a), sg = rnd() < 0.5 ? 1 : -1;
    st.f.push(mk(x + ux * 2, y + uy * 2, ux * 7, uy * 7, s * sg, 0));
    st.f.push(mk(x - ux * 2, y - uy * 2, -ux * 7, -uy * 7, -s * sg, 0));
  }
  ring(st, x, y, 0.3);
  st.nBirth++;
}

function stepSim(st, h, nt) {
  const F = st.f;
  let n = F.length;
  for (let i = 0; i < n; i++) {
    const f = F[i], a = abs(f.I);
    if (f.life < 1) f.life = min(1, f.life + h / 0.9);
    f.I *= exp((-h * (1 + 0.35 * a * a)) / TAU);
    if (a < IDIE && f.kill === 0 && !f.mg) f.kill = 1e-6;
    if (f.kill > 0) f.kill += h / 1.6;
    f.ie = f.I * ease(f.life) * (1 - ease(min(1, f.kill)));
    f.ax = 0;
    f.ay = 0;
  }
  // pair forces: like currents attract and spiral, unlike ones repel
  for (let i = 0; i < n; i++) {
    const a = F[i];
    for (let j = i + 1; j < n; j++) {
      const b = F[j], dx = b.x - a.x, dy = b.y - a.y;
      const r2 = dx * dx + dy * dy, pr = (KF * a.ie * b.ie * exp(-sqrt(r2) / RS)) / (r2 + SOFT2);
      let fx = pr * dx, fy = pr * dy;
      if (pr > 0) {
        fx -= KP * pr * dy;
        fy += KP * pr * dx;
      }
      const ma = max(0.5, abs(a.ie)), mb = max(0.5, abs(b.ie));
      a.ax += fx / ma;
      a.ay += fy / ma;
      b.ax -= fx / mb;
      b.ay -= fy / mb;
    }
  }
  const dm = exp(-GAMMA * h), sk = KICK * sqrt(h);
  for (let i = 0; i < n; i++) {
    const f = F[i];
    let ax = f.ax - (KC * (f.x - 32)) / 32, ay = f.ay - (KC * (f.y - 64)) / 64;
    if (f.x < 9) ax += 7 * (9 - f.x);
    else if (f.x > 55) ax -= 7 * (f.x - 55);
    if (f.y < 10) ay += 7 * (10 - f.y);
    else if (f.y > 118) ay -= 7 * (f.y - 118);
    f.vx = (f.vx + ax * h + sk * gauss()) * dm;
    f.vy = (f.vy + ay * h + sk * gauss()) * dm;
    const sp = sqrt(f.vx * f.vx + f.vy * f.vy);
    if (sp > 22) (f.vx *= 22 / sp), (f.vy *= 22 / sp);
    f.x += f.vx * h;
    f.y += f.vy * h;
  }
  // like filaments that come within 2.5 cores start to merge
  for (let i = 0; i < n; i++) {
    const a = F[i];
    if (a.mg || a.life < 1 || a.kill > 0) continue;
    for (let j = i + 1; j < n; j++) {
      const b = F[j];
      if (b.mg || b.life < 1 || b.kill > 0 || a.I * b.I <= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx * dx + dy * dy < MERGE_R2) {
        a.mg = b.mg = true;
        st.mg.push([a, b]);
        break;
      }
    }
  }
  // a merging pair closes up, keeping its momentum, and fuses: strengths add, position is the strength-weighted mean
  const kk = 1 - exp(-h / TM);
  for (let m = st.mg.length - 1; m >= 0; m--) {
    const [a, b] = st.mg[m];
    if (a.kill >= 1 || b.kill >= 1) {
      a.mg = b.mg = false;
      st.mg.splice(m, 1);
      continue;
    }
    const wa = abs(a.I), wb = abs(b.I), ws = wa + wb;
    const cx = (a.x * wa + b.x * wb) / ws, cy = (a.y * wa + b.y * wb) / ws;
    const vx = (a.vx * wa + b.vx * wb) / ws, vy = (a.vy * wa + b.vy * wb) / ws;
    a.x += (cx - a.x) * kk;
    a.y += (cy - a.y) * kk;
    b.x += (cx - b.x) * kk;
    b.y += (cy - b.y) * kk;
    a.vx += (vx - a.vx) * kk;
    a.vy += (vy - a.vy) * kk;
    b.vx += (vx - b.vx) * kk;
    b.vy += (vy - b.vy) * kk;
    const dx = a.x - b.x, dy = a.y - b.y;
    if (dx * dx + dy * dy < 0.36) {
      const I = cl(a.I + b.I, -IMAX, IMAX);
      F.splice(F.indexOf(a), 1);
      F.splice(F.indexOf(b), 1);
      const f = mk(cx, cy, vx, vy, I, 1);
      f.ie = I;
      F.push(f);
      st.mg.splice(m, 1);
      ring(st, cx, cy, 0.55 + 0.45 * min(1, ws / 2.5));
      st.nMerge++;
    }
  }
  for (let i = F.length - 1; i >= 0; i--) if (F[i].kill >= 1) (F.splice(i, 1), st.nDie++);
  // rings of released energy
  for (let i = st.rings.length - 1; i >= 0; i--) {
    st.rings[i].age += h;
    if (st.rings[i].age > 1.3) st.rings.splice(i, 1);
  }
  // supply: births when the population is low, now and then a tear when it is not
  st.cool -= h;
  if (st.cool <= 0 && F.length < NHARD - 2) {
    const N = alive(st);
    let net = 0;
    for (const f of F) if (f.kill === 0) net += f.I;
    if (N <= nt - 1 || abs(net) > 1.8) {
      tear(st, net);
      st.cool = 0.7 + rnd() * 1.1;
    } else if (N <= nt + 1 && rnd() < h * 0.2) {
      tear(st, net);
      st.cool = 1.6;
    }
  }
  st.th += 0.05 * sqrt(h) * gauss();
}

function seed(st, nt) {
  const n = max(5, nt);
  for (let i = 0; i < n; i++) {
    const [x, y] = site(st);
    const s = 1.0 + 1.0 * rnd();
    st.f.push(mk(x, y, 3 * gauss(), 3 * gauss(), (i & 1 ? -1 : 1) * s, 1));
  }
}

const target = (k3) => Math.round(10.5 + 6 * cl(k3, -1, 1));

export function setup(params) {
  params.st = {
    k: DEF.slice(), init: false, f: [], mg: [], rings: [], cool: 0, th: 0.5, left: 0,
    nBirth: 0, nMerge: 0, nDie: 0, sad: [],
    buf: new Float32Array(W * H * 3), AA: new Float32Array(W * H), BB: new Float32Array(W * H),
    FX: new Float64Array(NHARD + 4), FY: new Float64Array(NHARD + 4), FI: new Float64Array(NHARD + 4),
    CC2: new Float64Array(NHARD + 4), CA: new Float64Array(NHARD + 4),
  };
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || DEF;
  for (let i = 0; i < 4; i++) st.k[i] = isFinite(kv[i]) ? kv[i] : DEF[i];
  const nt = target(st.k[2]);
  if (!st.init) {
    st.init = true;
    seed(st, nt);
    for (let i = 0; i < 900; i++) stepSim(st, 1 / 20, nt);
  }
  // the clock of the filaments, in sim seconds, in steps no longer than 1/30 s
  // the guide field turns on the real clock, slowly and for good, so the far lines move even when the filaments creep
  const dr = cl(dt || 0, 0, 0.1);
  st.th += 0.025 * dr + 0.05 * sqrt(dr) * gauss();
  st.left += cl(dt || 0, 0, 0.1) * cl(st.k[1], 0.4, 4) * 0.35;
  while (st.left > 1e-6) {
    const h = min(st.left, 1 / 30);
    stepSim(st, h, nt);
    st.left -= h;
  }
}

// ---- field -------------------------------------------------------------------
// ev = [A, Ax, Ay, Axx, Axy, Ayy] of the flux plus the uniform guide field, at one point
const ev = new Float64Array(6);
function field(st, n, x, y, bx, by, si) {
  const FX = st.FX, FY = st.FY, FI = st.FI;
  let A = si * L0 + bx * (x - 32) + by * (y - 64), gx = bx, gy = by, hxx = 0, hxy = 0, hyy = 0;
  for (let k = 0; k < n; k++) {
    const dx = x - FX[k], dy = y - FY[k], q = dx * dx + dy * dy + A2, w = (2 * FI[k]) / q;
    A -= FI[k] * log(q);
    gx -= w * dx;
    gy -= w * dy;
    hxx -= w * (1 - (2 * dx * dx) / q);
    hyy -= w * (1 - (2 * dy * dy) / q);
    hxy += (w * 2 * dx * dy) / q;
  }
  ev[0] = A; ev[1] = gx; ev[2] = gy; ev[3] = hxx; ev[4] = hxy; ev[5] = hyy;
}

// X-points: saddles of the flux between pairs of like filaments, found by Newton's method from the point where the pulls balance
function saddles(st, n, bx, by, si) {
  const FX = st.FX, FY = st.FY, FI = st.FI, out = st.sad;
  out.length = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (FI[i] * FI[j] <= 0 || abs(FI[i]) < 0.3 || abs(FI[j]) < 0.3) continue;
      const dx = FX[j] - FX[i], dy = FY[j] - FY[i], d2 = dx * dx + dy * dy;
      if (d2 > 38 * 38 || d2 < 1) continue;
      const t = abs(FI[i]) / (abs(FI[i]) + abs(FI[j]));
      const x0 = FX[i] + dx * t, y0 = FY[i] + dy * t;
      let x = x0, y = y0, ok = false;
      for (let it = 0; it < 12; it++) {
        field(st, n, x, y, bx, by, si);
        const det = ev[3] * ev[5] - ev[4] * ev[4];
        if (det > -1e-7) break;
        let sx = -(ev[5] * ev[1] - ev[4] * ev[2]) / det, sy = -(-ev[4] * ev[1] + ev[3] * ev[2]) / det;
        const sl = sqrt(sx * sx + sy * sy);
        if (sl > 3) (sx *= 3 / sl), (sy *= 3 / sl);
        x += sx;
        y += sy;
        if (sl < 0.02) {
          ok = true;
          break;
        }
      }
      if (!ok || (x - x0) * (x - x0) + (y - y0) * (y - y0) > 0.16 * d2) continue;
      field(st, n, x, y, bx, by, si);
      const det = ev[3] * ev[5] - ev[4] * ev[4];
      if (det >= 0) continue;
      const lam = (ev[3] + ev[5]) / 2 - sqrt(((ev[3] - ev[5]) / 2) ** 2 + ev[4] * ev[4]);
      const wgt = sstep(0.003, 0.016, -lam);
      if (wgt <= 0.01) continue;
      let dup = false;
      for (const s of out) if ((s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < 9) dup = true;
      if (!dup) out.push({ x, y, A: ev[0], w: wgt });
    }
  }
  out.sort((a, b) => b.w - a.w);
  if (out.length > 2) out.length = 2;
}

// ---- colour ------------------------------------------------------------------
// a dim colour on the orange and yellow stretch of the wheel reads brown on the panel, so it is paled
const warm = (h) => {
  const d = (h - floor(h) - 0.1) * 6;
  return exp(-d * d);
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const tone = (v) => (v < 0.72 ? v : 0.72 + 0.28 * (1 - exp(-(v - 0.72) / 0.28)));

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const F = st.f, buf = st.buf, AA = st.AA, BB = st.BB;
  const FX = st.FX, FY = st.FY, FI = st.FI, CC2 = st.CC2, CA = st.CA;
  let n = 0, si = 0;
  for (let i = 0; i < F.length && n < NHARD; i++) {
    const f = F[i], a = abs(f.ie);
    if (a < 0.06) continue;
    FX[n] = f.x; FY[n] = f.y; FI[n] = f.ie;
    const c = 0.9 * A0;
    CC2[n] = c * c * (0.75 + 0.25 * min(a, 3));
    CA[n] = 0.5 + 0.5 * min(1, a / 1.2);
    si += f.ie;
    n++;
  }
  const dA = 2.0 * exp(-0.45 * cl(st.k[3], -1, 1));
  const B0 = 0.13, bx = B0 * cos(st.th), by = B0 * sin(st.th);

  // palette: gold for positive current, cyan for negative, both pale where they are dim
  const h0 = 0.115 + st.k[0], h1 = h0 + 0.42;
  const cw = [0, 0, 0], cc = [0, 0, 0];
  hsv(h0, 0.74 * (1 - 0.3 * warm(h0)), 1, cw);
  hsv(h1, 0.62 * (1 - 0.3 * warm(h1)), 1, cc);

  const INV = 1 / (2 * 0.66 * 0.66);
  const gr = 0.013, gg = 0.016, gb = 0.034;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let Af = si * L0, gx = 0, gy = 0, cwm = 0, ccm = 0;
      for (let k = 0; k < n; k++) {
        const dx = px - FX[k], dy = py - FY[k], r2 = dx * dx + dy * dy, q = r2 + A2, Ik = FI[k];
        Af -= Ik * log(q);
        const w = (2 * Ik) / q;
        gx -= w * dx;
        gy -= w * dy;
        if (r2 < 160) {
          const c2 = CC2[k], u = c2 / (r2 + c2), cv = CA[k] * u * u;
          if (Ik > 0) cwm += cv;
          else ccm += cv;
        }
      }
      const A = Af + bx * (px - 32) + by * (py - 64);
      gx += bx;
      gy += by;
      const B = sqrt(gx * gx + gy * gy) + 1e-3, sp = dA / B;
      // where lines would lie closer than 4.4 LED, only every 2nd, 4th or 8th level is drawn, and the others fade out along the way
      const mr = cl(log(4.4 / sp) * 1.4426950, 0, 3), m0 = floor(mr), fm = sstep(0.1, 0.9, mr - m0), s0 = sp * (1 << m0);
      const D0 = dA * (1 << m0), u0 = A / D0, u1 = A / (2 * D0);
      const d0 = abs(u0 - floor(u0 + 0.5)) * s0, d1 = abs(u1 - floor(u1 + 0.5)) * 2 * s0;
      const line = (1 - fm) * exp(-d0 * d0 * INV) + fm * exp(-d1 * d1 * INV);
      // positive flux is gold, negative is cyan, and the lines go white where the two meet
      const S = tanh(Af * 0.9), t0 = 1 - abs(S), tw = 0.85 * t0 * t0 + 0.08 + 0.17 * sstep(0.08, 0.5, B);
      const hot = sstep(0.08, 0.5, B), cs = S > 0 ? cw : cc;
      const lr = cs[0] + (1 - cs[0]) * tw, lg = cs[1] + (1 - cs[1]) * tw, lb = cs[2] + (1 - cs[2]) * tw;
      const L = line * (0.5 + 0.5 * hot);
      const wsh = 0.06 * tanh(abs(Af) * 0.4);
      const o = (y * W + x) * 3;
      AA[y * W + x] = A;
      BB[y * W + x] = B;
      buf[o] = gr + (L + wsh) * lr + cwm * (cw[0] + (1 - cw[0]) * 0.5) + ccm * (cc[0] + (1 - cc[0]) * 0.5);
      buf[o + 1] = gg + (L + wsh) * lg + cwm * (cw[1] + (1 - cw[1]) * 0.5) + ccm * (cc[1] + (1 - cc[1]) * 0.5);
      buf[o + 2] = gb + (L + wsh) * lb + cwm * (cw[2] + (1 - cw[2]) * 0.5) + ccm * (cc[2] + (1 - cc[2]) * 0.5);
    }
  }

  // separatrix through each X-point, and a faint crossing at the point itself
  saddles(st, n, bx, by, si);
  for (const s of st.sad) {
    const x0 = max(0, floor(s.x - 23)), x1 = min(W - 1, floor(s.x + 23)), y0 = max(0, floor(s.y - 23)), y1 = min(H - 1, floor(s.y + 23));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - s.x, dy = y + 0.5 - s.y, r2 = dx * dx + dy * dy;
        if (r2 > 484) continue;
        const i = y * W + x, d = abs(AA[i] - s.A) / BB[i];
        const v = s.w * (0.7 * exp(-d * d * INV) * (1 - sstep(8, 22, sqrt(r2))) + 0.16 * exp(-r2 / 5));
        const o = i * 3;
        buf[o] += v * 0.98;
        buf[o + 1] += v * 0.96;
        buf[o + 2] += v * 0.9;
      }
    }
  }
  // rings of release
  for (const r of st.rings) {
    const R = 2 + 20 * (1 - exp(-r.age / 0.45)), al = (1 - r.age / 1.3) * (1 - r.age / 1.3) * r.amp;
    const x0 = max(0, floor(r.x - R - 4)), x1 = min(W - 1, floor(r.x + R + 4)), y0 = max(0, floor(r.y - R - 4)), y1 = min(H - 1, floor(r.y + R + 4));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - r.x, dy = y + 0.5 - r.y, d = sqrt(dx * dx + dy * dy) - R;
        if (d > 4 || d < -4) continue;
        const v = al * exp(-d * d / 1.9), o = (y * W + x) * 3;
        buf[o] += v * 0.95;
        buf[o + 1] += v * 0.92;
        buf[o + 2] += v * 0.85;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, (tone(buf[o]) * 255 + 0.5) | 0, (tone(buf[o + 1]) * 255 + 0.5) | 0, (tone(buf[o + 2]) * 255 + 0.5) | 0);
    }
  }
}
