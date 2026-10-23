// ===== Patternflow pattern =====
// Title:   Domino Run
// Family:  physics
// Idea:    A fingertip tips the first of forty dominoes and the wave runs down six shelves and five spiral stairs at its own physical pace, each domino going dark in a low lamp's light as it falls, until the run rewinds.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: domino toppling runs, with the pushing group moved as one body after J. M. J. van Leeuwen's "The domino effect" (2004)
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.5..4, Spacing=-1..1, Angle=-1..1
//
// Knob 1: Colour. Ivory dominoes with black spots at 0; turned up, the run becomes a set of coloured toppling dominoes whose hues walk along the chain.
// Knob 2: Speed. How fast the film runs, finger and all: at 2 the forty dominoes fall in under five seconds, at 0.5 the wave crawls, at 4 it is half of real speed.
// Knob 3: Spacing. The gap between dominoes, from 0.44 to 0.8 of a domino's height; a wider gap means fewer dominoes and a flatter pile once they fall.
// Knob 4: Angle. Swings the camera round the run, from almost straight side-on, where only the narrow edges show, to well round, where the spotted faces fill the shelves.
// Buttons: K1 tap pushes: the first domino if the run is waiting, the start of a shelf ahead of the wave if it is running (a second wave), the rewind if it is over.

const W = 64;
const H = 128;
// Two by two samples per LED, or a tipping edge jumps a whole LED at a time.
const SS = 2;
const SW = W * SS;
const SH = H * SS;
const MAXN = 64;
const TIERS = 6;
// A domino in LEDs, in a real one's proportions (48 x 24 x 7.5 mm): one LED
// is three millimetres.
const DH = 16;
const DT = 2.5;
const DWID = 8;
// A shelf's straight run and the half turn at each end: the run goes into
// the room at the right and comes back at the left, so every other shelf
// stands 14 LEDs further back.
const RUN = 50;
const TURN_R = 7;
const BACK = 2 * TURN_R;
const SPACING = 20.5;
// The camera looks down ten degrees, enough to see shelves as shelves and
// turns as curves, and stands 40 degrees round to the left.
const PITCH = 0.18;
const YAW0 = 0.7;
const YAW_SWING = 0.44;
// Tipping about the front bottom edge: the centre of mass sits behind the
// edge by atan(t / h), and the moment of inertia is a slab's about its edge.
const BETA = Math.atan(DT / DH);
const RCOM = 0.5 * Math.hypot(DH, DT);
const INERTIA = (DH * DH + DT * DT) / 3;
// The share of the pushing group's momentum that carries into the next
// domino: 0.93 settles a long flat run at 1.5 sqrt(g h), as real runs go, at
// every spacing the knob reaches. A stair hands the wave height to spend, so
// a five-domino shelf after one runs nearer 1.8.
const KAPPA = 0.93;
// Gravity in LEDs per second squared. Real gravity at three millimetres an
// LED is about 3270, so the film runs at a little over a quarter of real
// speed and a flat run would cover 95 LEDs a second.
const G0 = 250;
const GROUP = 8;
const SUBSTEP = 1 / 150;
// The recording the rewind plays back: one pose a thirtieth of a second.
const MAXF = 600;
const REC_DT = 1 / 30;
const REWIND = 3;

// Spots on each half of a face, as bits of a three by three grid.
const PIPMASK = [0, 16, 257, 273, 325, 341, 365];
// Ivory as the lamp's warm bulb shows it.
const IVORY = [255, 230, 186];

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Hue h at saturation 0.85, full value.
function hsvInto(out, h) {
  for (let j = 0; j < 3; j++) {
    const k = (5 - 2 * j + 6 * (h - Math.floor(h))) % 6;
    out[j] = 255 * (1 - 0.85 * Math.max(0, Math.min(k, 4 - k, 1)));
  }
}

// The angle domino i leans at when it rests on domino i + 1 at angle tn. In
// i's frame (along its heading, y up) i + 1's back face starts at `gap` and
// its ground sits `dy` higher. Either i's top corner presses on i + 1's back
// face or, down a step, i's front face presses on i + 1's top back corner;
// i rests on whichever it reaches first. 9: neither is in reach.
function contact(gap, dy, tn) {
  let best = 9;
  const s = Math.sin(tn);
  const c = Math.cos(tn);
  const arg = (DT + dy * s - (gap + DT) * c) / DH;
  if (arg >= -1 && arg <= 1) {
    const ti = tn - Math.asin(arg);
    const px = DH * Math.sin(ti) - (gap + DT - DT * c);
    const py = DH * Math.cos(ti) - (dy + DT * s);
    const u = px * s + py * c;
    if (u >= -0.01 && u <= DH + 0.01) best = ti;
  }
  const cx = gap + DT - DT * c + DH * s;
  const cy = dy + DT * s + DH * c;
  if (cy > 0 && cx * cx + cy * cy <= DH * DH) {
    const ti = Math.atan2(cx, cy);
    if (ti < best) best = ti;
  }
  return best;
}

function tierY(k) {
  // Shelves at the back are lowered by what the camera's pitch lifts them,
  // so all six sit the same distance apart on the panel.
  const lift = (BACK * Math.cos(YAW0) * Math.sin(PITCH)) / Math.cos(PITCH);
  return -k * SPACING - (k % 2 ? lift : 0);
}

// A point on the run's path at arc length s: position, heading and ground.
function pathAt(s, out) {
  const turn = Math.PI * TURN_R;
  const per = RUN + turn;
  let k = Math.floor(s / per);
  let u = s - k * per;
  if (k >= TIERS - 1) {
    k = TIERS - 1;
    u = s - k * per;
  }
  const even = k % 2 === 0;
  if (u <= RUN || k === TIERS - 1) {
    out.x = even ? u : RUN - u;
    out.z = even ? 0 : -BACK;
    out.hx = even ? 1 : -1;
    out.hz = 0;
    out.y = tierY(k);
    out.turn = 0;
  } else {
    const a = (u - RUN) / TURN_R;
    if (even) {
      out.x = RUN + TURN_R * Math.sin(a);
      out.z = -TURN_R + TURN_R * Math.cos(a);
      out.hx = Math.cos(a);
      out.hz = -Math.sin(a);
    } else {
      out.x = -TURN_R * Math.sin(a);
      out.z = -TURN_R - TURN_R * Math.cos(a);
      out.hx = -Math.cos(a);
      out.hz = Math.sin(a);
    }
    // Each domino in a turn has its own step, going down to the next shelf.
    out.y = tierY(k) + (tierY(k + 1) - tierY(k)) * (a / Math.PI);
    out.turn = 1;
  }
  out.tier = k;
}

function build(P, ratio) {
  P.ratio = ratio;
  const d = ratio * DH;
  const total = TIERS * RUN + (TIERS - 1) * Math.PI * TURN_R;
  const q = {};
  let n = 0;
  let lastTier = -1;
  P.tierStart.fill(-1);
  for (let s = 1.5; s <= total - DH - 1 && n < MAXN; s += d) {
    pathAt(s, q);
    P.px[n] = q.x;
    P.py[n] = q.y;
    P.pz[n] = q.z;
    P.hx[n] = q.hx;
    P.hz[n] = q.hz;
    if (q.tier !== lastTier && !q.turn) {
      P.tierStart[q.tier] = n;
      lastTier = q.tier;
    }
    // The builder set every domino with its spots toward the camera.
    const toCam = -Math.sin(YAW0) * q.hx + Math.cos(YAW0) * q.hz;
    P.pipFront[n] = toCam > 0 ? 1 : 0;
    // Their numbers from two irrational strides, so no two neighbours match.
    P.pip0[n] = PIPMASK[Math.floor(((n * 0.618 + 0.3) % 1) * 7)];
    P.pip1[n] = PIPMASK[Math.floor(((n * 0.414 + 0.8) % 1) * 7)];
    P.turn[n] = q.turn;
    n++;
  }
  P.n = n;
  for (let i = 0; i < n - 1; i++) {
    const dx = P.px[i + 1] - P.px[i];
    const dz = P.pz[i + 1] - P.pz[i];
    P.gap[i] = dx * P.hx[i] + dz * P.hz[i] - DT;
    P.dy[i] = P.py[i + 1] - P.py[i];
  }
  for (let i = 0; i < n; i++) P.hue[i] = (i / n) * 0.85;
  standAll(P);
}

function standAll(P) {
  P.th.fill(0);
  P.om.fill(0);
  P.st.fill(0);
}

// The pushing group: a moving front and the dominoes leaning on it. Every
// angle in it follows from the front's, so it moves as one body.
function pose(P, f, x, out) {
  out[0] = x;
  let m = 1;
  for (let j = 1; j <= GROUP && f - j >= 0 && P.st[f - j] === 2; j++) {
    const i = f - j;
    out[j] = Math.min(Math.PI / 2, contact(P.gap[i], P.dy[i], out[j - 1]));
    m++;
  }
  return m;
}

function potential(P, f, x) {
  const m = pose(P, f, x, P.tmp);
  let v = 0;
  for (let j = 0; j < m; j++) v += RCOM * Math.cos(P.tmp[j] - BETA);
  return v;
}

function inertia(P, f, x) {
  const e = 1e-4;
  const m = pose(P, f, x + e, P.tmp);
  for (let j = 0; j < m; j++) P.tmp2[j] = P.tmp[j];
  pose(P, f, x - e, P.tmp);
  let s = 0;
  for (let j = 0; j < m; j++) {
    const J = (P.tmp2[j] - P.tmp[j]) / (2 * e);
    s += J * J;
  }
  return INERTIA * s;
}

function stepFront(P, f, g, dt) {
  const x = P.th[f];
  const e = 1e-4;
  const dV = (g * (potential(P, f, x + e) - potential(P, f, x - e))) / (2 * e);
  const I = inertia(P, f, x);
  const dI = (inertia(P, f, x + 1e-3) - inertia(P, f, x - 1e-3)) / 2e-3;
  let w = P.om[f];
  // A group whose inertia shrinks hands energy back to its front. One whose
  // inertia grew would make a leaning domino outrun the one under it, and a
  // contact only pushes: that domino lags instead.
  w += ((-dV - 0.5 * Math.min(0, dI) * w * w) / I) * dt;
  let th = x + w * dt;
  if (th < 0) {
    // Not pushed hard enough: it rocks back and stands.
    th = 0;
    w = 0;
    P.st[f] = 0;
  }
  const last = f === P.n - 1;
  if (!last) {
    const next = P.st[f + 1];
    const c = contact(P.gap[f], P.dy[f], P.th[f + 1]);
    if (th >= c) {
      th = c;
      if (next === 0) {
        // Generalised momentum carries across: the old front now moves at
        // J times the new one's rate.
        const J = (contact(P.gap[f], P.dy[f], 1e-3) - contact(P.gap[f], P.dy[f], 0)) / 1e-3;
        const before = I * w;
        P.st[f] = 2;
        P.st[f + 1] = 1;
        P.th[f + 1] = 0;
        P.th[f] = th;
        const after = inertia(P, f + 1, 0);
        P.om[f + 1] = (KAPPA * before * J) / after;
        P.om[f] = 0;
        return;
      }
      // It met dominoes that already lie: the group stops on them.
      P.st[f] = 2;
      P.om[f] = 0;
      P.th[f] = th;
      return;
    }
  } else if (th >= Math.PI / 2) {
    // The last one lands flat and bounces.
    th = Math.PI / 2;
    w = Math.abs(w) > 1.5 ? -0.22 * w : 0;
    if (w === 0) P.st[f] = 3;
  }
  P.th[f] = th;
  P.om[f] = w;
}

function settle(P) {
  // Leaning dominoes follow the one they lean on, front to back.
  for (let i = P.n - 2; i >= 0; i--)
    if (P.st[i] === 2) P.th[i] = Math.min(Math.PI / 2, contact(P.gap[i], P.dy[i], P.th[i + 1]));
}

function record(P) {
  if (P.frames >= MAXF) {
    // Out of tape: keep every other pose and record at half the rate.
    const n = P.n;
    for (let f = 0; f < MAXF / 2; f++) for (let i = 0; i < n; i++) P.tape[f * MAXN + i] = P.tape[2 * f * MAXN + i];
    P.frames = MAXF / 2;
    P.recEvery *= 2;
  }
  const o = P.frames * MAXN;
  for (let i = 0; i < P.n; i++) P.tape[o + i] = Math.round((P.th[i] / (Math.PI / 2)) * 255);
  P.frames++;
}

function startPush(P, i) {
  P.finger = 0;
  P.fingerOn = i;
  P.st[i] = 4;
}

export function setup(params) {
  const P = params;
  // Per domino: pivot (front bottom edge), heading, gap and step to the next.
  for (const key of ["px", "py", "pz", "hx", "hz", "gap", "dy", "th", "om", "hue"]) P[key] = new Float32Array(MAXN);
  for (const key of ["st", "pipFront", "turn", "pfOn"]) P[key] = new Uint8Array(MAXN);
  P.pip0 = new Uint16Array(MAXN);
  P.pip1 = new Uint16Array(MAXN);
  P.tierStart = new Int16Array(TIERS);
  P.tmp = new Float64Array(GROUP + 2);
  P.tmp2 = new Float64Array(GROUP + 2);
  P.tape = new Uint8Array(MAXN * MAXF);
  P.zbuf = new Float32Array(SW * SH);
  // Which domino's spotted face each sample shows, plus one.
  P.own = new Int16Array(SW * SH);
  P.pf = new Float32Array(MAXN * 6);
  P.cbuf = new Uint8Array(SW * SH * 3);
  P.pix = new Float32Array(W * H * 3);
  P.col = new Float32Array(3);
  Object.assign(P, { built: false, mode: "wait", timer: 1.4, finger: -1, fingerOn: 0, frames: 0, play: 0, colour: 0, speed: 2, yaw: YAW0 });
  build(P, 0.62);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  dt = Math.min(dt, 0.1);
  P.colour = cl(k[0], 0, 1);
  P.speed = cl(k[1], 0.5, 4);
  const ratio = 0.62 + 0.18 * cl(k[2], -1, 1);
  P.yaw = YAW0 + YAW_SWING * cl(k[3], -1, 1);
  // Everything below runs in film time.
  dt *= P.speed / 2;

  // A new spacing is a new run: the builder sets it out again and pushes.
  if (Math.abs(ratio - P.ratio) > 0.004) {
    build(P, ratio);
    P.mode = "wait";
    P.timer = P.built ? 0.8 : 1.4;
    P.finger = -1;
    P.frames = 0;
  }
  P.built = true;

  if (input.btnPressed && input.btnPressed[0]) {
    if (P.mode === "wait") P.timer = 0;
    else if (P.mode === "run" && P.finger < 0) {
      // A second push at the start of the first shelf the wave has not reached.
      let far = 0;
      for (let i = 0; i < P.n; i++) if (P.st[i] !== 0) far = i;
      for (let t = 0; t < TIERS; t++) {
        const s = P.tierStart[t];
        if (s > far + 2 && P.st[s] === 0) {
          startPush(P, s);
          break;
        }
      }
    } else if (P.mode === "rest") P.timer = 0;
  }

  if (P.mode === "wait") {
    P.timer -= dt;
    if (P.timer <= 0 && P.finger < 0) {
      startPush(P, 0);
      Object.assign(P, { mode: "run", frames: 0, recEvery: 1, recT: 0, quiet: 0 });
    }
  }

  // The fingertip: in for 0.4 s, pushes for 0.22 s until the domino is past
  // its balance point, lets go and goes back out.
  if (P.finger >= 0) {
    P.finger += dt;
    const i = P.fingerOn;
    if (P.finger < 0.4) P.th[i] = 0;
    else if (P.finger < 0.62) P.th[i] = (BETA + 0.07) * smooth(0.4, 0.62, P.finger);
    else if (P.st[i] === 4) {
      P.st[i] = 1;
      P.th[i] = BETA + 0.07;
      P.om[i] = 0.7;
    }
    if (P.finger > 1.1) P.finger = -1;
  }

  if (P.mode === "run") {
    const steps = Math.ceil(dt / SUBSTEP);
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = P.n - 1; i >= 0; i--) if (P.st[i] === 1) stepFront(P, i, G0, h);
      settle(P);
    }
    P.recT += dt;
    if (P.recT >= REC_DT * P.recEvery) {
      P.recT -= REC_DT * P.recEvery;
      record(P);
    }
    let moving = P.finger >= 0;
    for (let i = 0; i < P.n && !moving; i++) if (P.st[i] === 1 || P.st[i] === 4) moving = true;
    P.quiet = moving ? 0 : P.quiet + dt;
    if (P.quiet > 0.4) {
      record(P);
      P.mode = "rest";
      P.timer = 2.2;
    }
  } else if (P.mode === "rest") {
    P.timer -= dt;
    if (P.timer <= 0) {
      P.mode = "rewind";
      P.play = P.frames - 1;
    }
  } else if (P.mode === "rewind") {
    // The film runs backwards three times as fast; every domino springs up
    // the way it fell.
    P.play -= (dt * REWIND) / (REC_DT * P.recEvery);
    if (P.play <= 0) {
      standAll(P);
      P.mode = "wait";
      P.timer = 1.1;
    } else {
      const f0 = Math.floor(P.play);
      const f1 = Math.min(P.frames - 1, f0 + 1);
      const a = P.play - f0;
      const s = Math.PI / 2 / 255;
      for (let i = 0; i < P.n; i++)
        P.th[i] = s * ((1 - a) * P.tape[f0 * MAXN + i] + a * P.tape[f1 * MAXN + i]);
    }
  }
}

// The camera: screen right r, screen up u, c toward the camera.
function camera(P) {
  const sp = Math.sin(P.yaw);
  const cp = Math.cos(P.yaw);
  const se = Math.sin(PITCH);
  const ce = Math.cos(PITCH);
  P.rx = cp;
  P.rz = sp;
  P.ux = sp * se;
  P.uy = ce;
  P.uz = -cp * se;
  P.cx = -sp * ce;
  P.cy = se;
  P.cz = cp * ce;
  // Centre the run on the panel by its top and bottom shelves' corners.
  const b = [1e9, -1e9, 1e9, -1e9];
  for (const x of [-TURN_R - 3, RUN + TURN_R + 3])
    for (const z of [DWID, -BACK - DWID])
      for (const y of [tierY(0) + DH + 1, tierY(TIERS - 1) - 2]) {
        const sx = x * P.rx + z * P.rz;
        const sy = -(x * P.ux + y * P.uy + z * P.uz);
        b[0] = Math.min(b[0], sx);
        b[1] = Math.max(b[1], sx);
        b[2] = Math.min(b[2], sy);
        b[3] = Math.max(b[3], sy);
      }
  P.X0 = W / 2 - (b[0] + b[1]) / 2;
  P.Y0 = H / 2 - (b[2] + b[3]) / 2;
}

// One lamp, low on the left: it lights a standing domino's face full on and
// only grazes one that lies. The room adds a little light to the wood.
const LX = -0.975;
const LY = 0.05;

// One face of a box into the samples where it is nearest: corner o, edges a
// and b (across and up on a spotted face), outward normal n.
function face(P, ox, oy, oz, ax, ay, az, bx, by, bz, nx, ny, nz, col, spots) {
  if (nx * P.cx + ny * P.cy + nz * P.cz <= 0.02) return;
  const shade = P.amb + P.dif * Math.max(0, nx * LX + ny * LY) + P.front * Math.max(0, nz);
  const cr = col[0] * shade;
  const cg = col[1] * shade;
  const cb = col[2] * shade;
  const sx = (P.X0 + ox * P.rx + oz * P.rz) * SS;
  const sy = (P.Y0 - (ox * P.ux + oy * P.uy + oz * P.uz)) * SS;
  const sd = ox * P.cx + oy * P.cy + oz * P.cz;
  const eax = (ax * P.rx + az * P.rz) * SS;
  const eay = -(ax * P.ux + ay * P.uy + az * P.uz) * SS;
  const ead = ax * P.cx + ay * P.cy + az * P.cz;
  const ebx = (bx * P.rx + bz * P.rz) * SS;
  const eby = -(bx * P.ux + by * P.uy + bz * P.uz) * SS;
  const ebd = bx * P.cx + by * P.cy + bz * P.cz;
  const det = eax * eby - eay * ebx;
  if (Math.abs(det) < 0.05) return;
  const inv = 1 / det;
  const minX = Math.max(0, Math.floor(sx + Math.min(0, eax) + Math.min(0, ebx)));
  const maxX = Math.min(SW - 1, Math.ceil(sx + Math.max(0, eax) + Math.max(0, ebx)));
  const minY = Math.max(0, Math.floor(sy + Math.min(0, eay) + Math.min(0, eby)));
  const maxY = Math.min(SH - 1, Math.ceil(sy + Math.max(0, eay) + Math.max(0, eby)));
  const zb = P.zbuf;
  const cbuf = P.cbuf;
  const own = P.own;
  const id = spots ? P.cur + 1 : 0;
  // Spots once the face is wide and tall enough for three by three a half.
  const la = Math.hypot(eax, eay);
  const lb = Math.hypot(ebx, eby);
  const showPips = id > 0 && Math.abs(det) > 2.6 * SS * lb && Math.abs(det) > 6 * SS * la;
  if (showPips) {
    P.pf.set([sx, sy, eax, eay, ebx, eby], P.cur * 6);
    P.pfOn[P.cur] = 1;
  }
  for (let y = minY; y <= maxY; y++) {
    const qy = y + 0.5 - sy;
    for (let x = minX; x <= maxX; x++) {
      const qx = x + 0.5 - sx;
      const a = (qx * eby - qy * ebx) * inv;
      if (a < 0 || a > 1) continue;
      const b = (eax * qy - eay * qx) * inv;
      if (b < 0 || b > 1) continue;
      const d = sd + a * ead + b * ebd;
      const s = y * SW + x;
      if (d <= zb[s]) continue;
      zb[s] = d;
      own[s] = id;
      // The bar between the two halves.
      const k = showPips && Math.abs(b - 0.5) < 0.03 ? 0.5 : 1;
      cbuf[s * 3] = cr * k;
      cbuf[s * 3 + 1] = cg * k;
      cbuf[s * 3 + 2] = cb * k;
    }
  }
}

// A box from corner o along three edges a (thickness), b (across), c (up).
// pip: -1 no spots, 0 spots on the a = 0 face, 1 on the a = 1 face.
function box(P, ox, oy, oz, ax, ay, az, bx, by, bz, cx, cy, cz, la, lb, lc, col, pip) {
  const na = 1 / la;
  const nb = 1 / lb;
  const nc = 1 / lc;
  face(P, ox, oy, oz, bx, by, bz, cx, cy, cz, -ax * na, -ay * na, -az * na, col, pip === 0);
  face(P, ox + ax, oy + ay, oz + az, bx, by, bz, cx, cy, cz, ax * na, ay * na, az * na, col, pip === 1);
  face(P, ox, oy, oz, ax, ay, az, cx, cy, cz, -bx * nb, -by * nb, -bz * nb, col, false);
  face(P, ox + bx, oy + by, oz + bz, ax, ay, az, cx, cy, cz, bx * nb, by * nb, bz * nb, col, false);
  face(P, ox, oy, oz, ax, ay, az, bx, by, bz, -cx * nc, -cy * nc, -cz * nc, col, false);
  face(P, ox + cx, oy + cy, oz + cz, ax, ay, az, bx, by, bz, cx * nc, cy * nc, cz * nc, col, false);
}

const WOOD = [52, 34, 22];
const WOOD_EDGE = [96, 64, 40];

export function draw(display, params, time) {
  const P = params;
  camera(P);
  P.zbuf.fill(-1e9);
  P.own.fill(0);
  P.pfOn.fill(0);
  P.cur = -1;

  // Dark wood that takes the room's light on its front edges, so a shelf
  // reads as one dim line: a plank under each straight run, and in each turn
  // a spiral stair, a post with a step out from it under every domino.
  Object.assign(P, { amb: 0.1, dif: 0.2, front: 0.3 });
  const deep = DWID + 2.4;
  for (let k = 0; k < TIERS; k++) {
    const y = tierY(k);
    box(P, -2, y - 1, (k % 2 ? -BACK : 0) + deep / 2, RUN + 4, 0, 0, 0, 0, -deep, 0, 1, 0, RUN + 4, deep, 1, WOOD_EDGE, -1);
    const tall = y - tierY(k + 1);
    if (k < TIERS - 1) box(P, (k % 2 ? 0 : RUN) - 0.8, y - tall, -TURN_R - 0.8, 1.6, 0, 0, 0, 0, 1.6, 0, tall, 0, 1.6, 1.6, tall, WOOD, -1);
  }
  const out = TURN_R + DWID / 2 + 0.8;
  const step = DT + 2.8;
  for (let i = 0; i < P.n; i++) {
    const hx = P.hx[i];
    const hz = P.hz[i];
    if (P.turn[i]) box(P, P.px[i] - hx * (step - 1.4) + hz * TURN_R, P.py[i] - 1, P.pz[i] - hz * (step - 1.4) - hx * TURN_R, hx * step, 0, hz * step, -hz * out, 0, hx * out, 0, 1, 0, step, out, 1, WOOD_EDGE, -1);
  }

  // The dominoes, in the lamp's light.
  Object.assign(P, { amb: 0.04, dif: 0.96, front: 0 });
  const q = P.col;
  const sat = smooth(0, 0.35, P.colour);
  for (let i = 0; i < P.n; i++) {
    const s = Math.sin(P.th[i]);
    const c = Math.cos(P.th[i]);
    const hx = P.hx[i];
    const hz = P.hz[i];
    // Tipped edges: thickness along the heading, width across, height up.
    const ax = hx * c * DT;
    const az = hz * c * DT;
    const ox = P.px[i] - ax + hz * (DWID / 2);
    const oz = P.pz[i] - az - hx * (DWID / 2);
    hsvInto(q, P.hue[i] + P.colour);
    for (let j = 0; j < 3; j++) q[j] = IVORY[j] + (q[j] - IVORY[j]) * sat;
    P.cur = i;
    box(P, ox, P.py[i] + s * DT, oz, ax, -s * DT, az, -hz * DWID, 0, hx * DWID, hx * s * DH, c * DH, hz * s * DH, DT, DWID, DH, q, P.pipFront[i]);
  }

  // Resolve the samples over a dark wall, a little warmer at the foot.
  const pix = P.pix;
  const zb = P.zbuf;
  const cb = P.cbuf;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < 4; j++) {
        const s = (y * SS + (j >> 1)) * SW + x * SS + (j & 1);
        if (zb[s] > -1e8) {
          r += cb[s * 3];
          g += cb[s * 3 + 1];
          b += cb[s * 3 + 2];
        } else {
          r += 5 + (3 * y) / H;
          g += 5 + (2 * y) / H;
          b += 9;
        }
      }
      const p = (y * W + x) * 3;
      pix[p] = r / 4;
      pix[p + 1] = g / 4;
      pix[p + 2] = b / 4;
    }

  drawPips(P);
  if (P.finger >= 0) drawFinger(P);

  for (let p = 0; p < W * H; p++) display.setPixel(p % W, Math.floor(p / W), Math.min(255, pix[p * 3]), Math.min(255, pix[p * 3 + 1]), Math.min(255, pix[p * 3 + 2]));
}

// The spots, one dark LED each where that LED shows the spotted face. Drawn
// soft, they smeared half of every face to grey.
function drawPips(P) {
  const pix = P.pix;
  const own = P.own;
  for (let i = 0; i < P.n; i++) {
    if (!P.pfOn[i]) continue;
    const o = i * 6;
    for (let half = 0; half < 2; half++) {
      const mask = half ? P.pip1[i] : P.pip0[i];
      for (let bit = 0; bit < 9; bit++) {
        if (!(mask & (1 << bit))) continue;
        const a = 0.2 + 0.3 * (bit % 3);
        const b = 0.5 * half + 0.1 + 0.15 * Math.floor(bit / 3);
        const x = Math.floor((P.pf[o] + a * P.pf[o + 2] + b * P.pf[o + 4]) / SS);
        const y = Math.floor((P.pf[o + 1] + a * P.pf[o + 3] + b * P.pf[o + 5]) / SS);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        let mine = 0;
        for (let j = 0; j < SS; j++) for (let k = 0; k < SS; k++) if (own[(y * SS + j) * SW + x * SS + k] === i + 1) mine++;
        if (mine < 3) continue;
        const p = (y * W + x) * 3;
        pix[p] *= 0.08;
        pix[p + 1] *= 0.08;
        pix[p + 2] *= 0.08;
      }
    }
  }
}

// The fingertip comes from behind the domino it pushes, a little from above,
// and touches the domino's back three quarters of the way up.
function drawFinger(P) {
  const i = P.fingerOn;
  const s = Math.sin(P.th[i]);
  const c = Math.cos(P.th[i]);
  const hx = P.hx[i];
  const hz = P.hz[i];
  const back = DH * 0.75 * s - DT * c;
  const tx = P.px[i] + hx * back;
  const ty = P.py[i] + DT * s + c * DH * 0.75;
  const tz = P.pz[i] + hz * back;
  // Backwards along the heading on the panel, tilted 20 degrees up.
  const dx = -(hx * P.rx + hz * P.rz);
  const dy = hx * P.ux + hz * P.uz;
  const up = dx > 0 ? -0.34 : 0.34;
  const l = Math.hypot(dx, dy) || 1;
  const ex = (dx * Math.cos(up) - dy * Math.sin(up)) / l;
  const ey = (dx * Math.sin(up) + dy * Math.cos(up)) / l;
  const f = P.finger;
  const out = 2 + 26 * (f < 0.4 ? 1 - smooth(0, 0.4, f) : smooth(0.62, 1.05, f));
  const ax = P.X0 + tx * P.rx + tz * P.rz + ex * out;
  const ay = P.Y0 - (tx * P.ux + ty * P.uy + tz * P.uz) + ey * out;
  const pix = P.pix;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - ax;
      const py = y + 0.5 - ay;
      const along = Math.max(0, px * ex + py * ey);
      const cov = Math.min(1, 2.2 - Math.hypot(px - along * ex, py - along * ey));
      if (cov <= 0) continue;
      // Skin, lighter along the top, and the nail at the tip.
      const top = ((ex > 0 ? ey : -ey) * px - (ex > 0 ? ex : -ex) * py) / 1.7;
      const nail = along < 2.6 && top > -0.2;
      const p = (y * W + x) * 3;
      pix[p] += ((nail ? 250 : 232 + 14 * top) - pix[p]) * cov;
      pix[p + 1] += ((nail ? 222 : 170 + 18 * top) - pix[p + 1]) * cov;
      pix[p + 2] += ((nail ? 212 : 138 + 16 * top) - pix[p + 2]) * cov;
    }
}
