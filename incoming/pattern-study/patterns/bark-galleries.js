// ===== Patternflow pattern =====
// Title:   Bark Galleries
// Family:  barkbeetle
// Idea:    The inner face of pine bark slides slowly down the panel, grain running up and down, while bark beetles carve it: a mother bores a straight egg gallery along the grain with egg niches on both sides, and her larvae bore outward across it, widening as they grow, turning away from any gallery ahead and ending in oval pupal chambers, so fishbone combs (or, up the Form knob, stars) are engraved into warm cream wood with a lit edge and a shadow edge, fill with dark frass and gather a cool blue-grey stain as they age.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: bark beetle gallery systems, the egg gallery along the grain with larval galleries across it in Scolytus and the star from a nuptial chamber in Ips and Pityogenes, as forest entomology has drawn them since Ratzeburg's Die Forst-Insecten (1837 to 1844, from memory); the blue-stain fungi the beetles carry (Ophiostoma, Münch, 1907, from memory); agents that steer by sampling what lies ahead, after Craig Reynolds's steering behaviours (1987, 1999, from memory). Original here: carving into a ring of bark at half-LED rows that scrolls along the trunk, larvae that widen with age and pupate where blocked, and per-LED relief shading that turns depth into an engraving, pattern round 260
// Round:   260
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Brood=-1..1, Form=0..1
//
// Knob 1: Hue. Turns the wood round a loop of five barks: warm pine cream and tan at 0, pale spruce at 0.2, rose larch at 0.4, ochre oak at 0.6 and grey weathered wood at 0.8, back to pine at 1. The galleries follow the wood from tan or umber when fresh to dark brown frass; the blue stain stays the same cool blue-grey on all of them.
// Knob 2: Speed. 0.5 to 4, opening at 2. The pace of everything at once, carving and scrolling: at 2 the bark slides down 0.5 LED a second, a mother bores 0.45 LED a second and a larva 0.3, so one system takes about a minute and a half and a strip of bark crosses the panel in a little over four minutes. At 0.5 it is four times slower and nearly still; at 4 twice as fast.
// Knob 3: Brood. -1 to 1, opening at 0. How many eggs a mother lays, alternately left and right: one niche every 4 LED on each side of her gallery at 0, every 7.6 LED at -1, a few sparse ribs with wood between, and every 2.9 LED at 1, a dense comb whose larvae crowd each other, fan out hard and many pupate short.
// Knob 4: Form. 0 to 1, opening at 0.06. The kind of beetle. Up to about 0.2 every system is two nearly straight egg galleries running up and down the grain from one chamber, 15 to 26 LED each, the fishbone. Higher, more systems have three to six arms at any angle round a bigger nuptial chamber, gently curved and 11 to 19 LED long, with shorter larval galleries that sweep outward along them, the star; at 1 every system is a star.

// What the picture is. The bark is a ring of 192 LED rows held at half-LED resolution (384 rows of 64), periodic across the trunk, and the panel
// is a window on it that slides down 0.5 LED a model second. Fresh rows enter 40 LED above the top edge and are cleared as they come in; rows
// leave 23 LED under the bottom edge. Three buffers hold what has been carved: the depth D of each cell (0 to 1), when it was first cut, and
// the gallery that owns it. Every 0.7 model seconds a system tries to start somewhere from 26 LED above the panel to 90 LED down it, and does
// when nothing is carved within 12 LED and no chamber is inside an ellipse 30 LED across and 36 along the grain (70 percent of that for a system
// older than 70 s, which has carved its ground). A system is a nuptial chamber and its arms. An arm is an agent 3.2 LED wide with a strong pull
// back to its own direction and a little meander; it lays egg niches alternately left and right at the Brood spacing and stops at its length or
// when something is ahead. An egg hatches 3 to 7 s later into a larva heading out roughly square to the arm. A larva's curvature is a slow
// random walk, it is pulled toward its first direction tipped along the arm (more near the arm's tip, so the comb fans into a spindle), and
// every step it reads the owner buffer at seven points ahead and to the sides. It veers away from other galleries, turns on the spot when one
// is right ahead, and pupates when it has turned 60 degrees without finding a way. Its width grows from 1.5 to about 3.1 LED over 9 to 16 LED
// of travel, and it ends in an oval chamber. A guard refuses to cut a cell when another gallery's floor is within 1.6 LED, so walls of wood
// stay between galleries even where the steering is late.
// Drawing. Each cut is a soft disc whose half-depth edge sits at the gallery's half width: a flat floor and walls about 1.2 LED wide. The panel
// is drawn from the half-LED rows with a one-LED box at the scroll offset, so a groove keeps its softness while it slides (edge contrast
// breathes by 4 percent once a second at the opening). Light comes from the upper left: the slope of D darkens a wall facing away from it to
// the shadow colour and lifts one facing it to a highlight. The floor is fresh tan when cut and dark frass a minute later. The stain is a field
// at 2 LED cells: a gallery seeds it from 35 s old, rising to full at 140 s; it diffuses at 0.045 LED^2 a second and fades at 0.2 percent a
// second, a halo about 5 LED wide. The wood is value noise stretched along the grain in the bark's own frame. The pre-run slides 212 LED of
// bark from empty, so the opening panel is fresh at the top and stained at the bottom.

const W = 64, H = 128;
const RL = 192, RF = RL * 2, NF = W * RF;   // bark rows in the ring, LED and half-LED
const MT = 40, MB = 8;                      // margin above the panel where systems may start, and below it where carving still goes
const CW = 32, CR = RL / 2, NC = CW * CR;   // the stain grid, 2 LED cells
const { floor, sqrt, abs, exp, sin, cos, atan2, min, max, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
const wrapA = (a) => {
  while (a > PI) a -= 2 * PI;
  while (a < -PI) a += 2 * PI;
  return a;
};

// ---- rates, per model second; K2 runs model time at K2 / 2 times real time
const V_SCROLL = 0.5;      // LED the bark slides
const V_ARM = 0.45;        // LED a mother bores
const V_LARVA = 0.3;       // LED a larva bores
const W_ARM = 3.2;         // egg gallery width, LED
const W_L0 = 1.5, W_L1 = 3.1; // larval gallery width at hatching and at the end
const STEP = 0.33;         // LED between cuts along a gallery
const SPAWN_DT = 0.7;      // model seconds between tries to start a system
const STAIN_DT = 1;        // model seconds between steps of the stain
const Q_DIFF = 0.045 / 4;   // stain diffusion, in cells^2 (a cell is 2 LED)
const Q_RATE = 0.02;      // how fast an old gallery stains the cell it is in
const Q_FADE = 0.002;     // how fast stain fades where nothing feeds it, so it stays a halo some 5 LED wide
const PRE = MT + H + 44;   // LED of bark the pre-run slides through

function hsh(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// value noise with x periodic over px lattice cells, -0.5..0.5
function vn(x, y, px, salt) {
  const x0 = floor(x), y0 = floor(y);
  let fx = x - x0, fy = y - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const i0 = ((x0 % px) + px) % px, i1 = i0 + 1 === px ? 0 : i0 + 1;
  const a = hsh(i0, y0, salt), b = hsh(i1, y0, salt), c = hsh(i0, y0 + 1, salt), d = hsh(i1, y0 + 1, salt);
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy - 0.5;
}

const rowF = (f) => ((f % RF) + RF) % RF;
const rowC = (c) => ((c % CR) + CR) % CR;

// cells within 1.6 LED of a cell, as (dx, fine row) pairs: a cut is refused when another gallery's floor is among them
const GUARD = [];
for (let df = -3; df <= 3; df++) for (let dx = -1; dx <= 1; dx++) if (dx * dx + (df * 0.5) * (df * 0.5) <= 2.6) GUARD.push(dx, df);

function makeState() {
  return {
    ready: false, salt: floor(rnd() * 1e9), tau: 0, scroll: 0, bTop: -MT,
    k: [0, 2, 0, 0.06], nid: 1, spawnAcc: 0, stainAcc: 0,
    D: new Float32Array(NF), T: new Float32Array(NF), ID: new Int32Array(NF),
    WT: new Float32Array(NF), FM: new Float32Array(NF),
    G: new Float32Array(NC), GT: new Float32Array(NC), Q: new Float32Array(NC), Q2: new Float32Array(NC),
    systems: [], nests: [], arms: [], eggs: [], larvae: [], pupae: [],
    col: new Float32Array(257 * W * 3), qrow: new Float32Array(CW),
    pal: new Float32Array(24), palAt: -1,
  };
}

// ---- the bark
function woodRow(S, b) {
  const salt = S.salt;
  for (let h = 0; h < 2; h++) {
    const f = 2 * b + h, yy = (f + 0.5) * 0.5, ri = rowF(f) * W;
    const warp = 3.0 * vn(0.5, yy / 41, 1, salt + 5) + 1.2 * vn(0.5, yy / 13, 1, salt + 6);
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5 + warp;
      S.WT[ri + x] = 0.52 + 0.42 * vn(xx / 4, yy / 21, 16, salt + 1) + 0.26 * vn(xx / 2, yy / 9, 32, salt + 2) + 0.2 * vn(xx / 16, yy / 47, 4, salt + 3);
      S.FM[ri + x] = hsh(x >> 1, floor(yy / 1.5), salt + 4) - 0.5;
      S.D[ri + x] = 0;
      S.T[ri + x] = 0;
      S.ID[ri + x] = 0;
    }
  }
  if (b & 1) {
    const ci = rowC((b - 1) >> 1) * CW;
    for (let x = 0; x < CW; x++) {
      S.G[ci + x] = 0;
      S.GT[ci + x] = 0;
      S.Q[ci + x] = 0;
    }
  }
}

const bottomB = (S) => -S.scroll + H + MB;

function occAt(S, X, B, gid, pid) {
  if (B < S.bTop + 1 || B >= bottomB(S)) return 1;
  const i = rowF(floor(B * 2)) * W + (floor(X) & 63);
  if (S.D[i] < 0.3) return 0;
  const id = S.ID[i];
  return id === gid || id === pid ? 0 : 1;
}

// a soft disc of depth `depth`, its half-depth edge at radius r; pid is a gallery this one may cut into (its mother's)
function carve(S, X, B, r, depth, gid, pid) {
  const ro = r + 0.6, D = S.D, ID = S.ID, T = S.T, G = S.G, GT = S.GT, tau = S.tau;
  const x0 = floor(X - ro), x1 = floor(X + ro);
  let f0 = floor((B - ro) * 2), f1 = floor((B + ro) * 2);
  const fmin = 2 * S.bTop, fmax = floor(bottomB(S) * 2);
  if (f0 < fmin) f0 = fmin;
  if (f1 > fmax) f1 = fmax;
  for (let f = f0; f <= f1; f++) {
    const dy = (f + 0.5) * 0.5 - B, ro_ = rowF(f) * W;
    for (let xi = x0; xi <= x1; xi++) {
      const dx = xi + 0.5 - X, d = sqrt(dx * dx + dy * dy);
      let p = (ro - d) / 1.2;
      if (p <= 0) continue;
      if (p > 1) p = 1;
      const v = depth * p * p * (3 - 2 * p), x = xi & 63, i = ro_ + x;
      if (v <= D[i] + 0.01) continue;
      let blocked = false;
      for (let g = 0; g < GUARD.length; g += 2) {
        const j = rowF(f + GUARD[g + 1]) * W + ((x + GUARD[g]) & 63), o = ID[j];
        if (o !== 0 && o !== gid && o !== pid && D[j] > 0.4) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      if (D[i] === 0) T[i] = tau;
      D[i] = v;
      if (v > 0.3 && ID[i] === 0) {
        ID[i] = gid;
        const c = rowC(f >> 2) * CW + (x >> 1);
        if (G[c] === 0) {
          G[c] = 1;
          GT[c] = tau;
        }
      }
    }
  }
}

// an oval: half length a along th, half width bb
function carveOval(S, X, B, th, a, bb, depth, gid, pid) {
  const n = max(1, Math.ceil((a - bb) / 0.3));
  const c = cos(th), s = sin(th);
  for (let k = -n; k <= n; k++) {
    const t = (k / n) * (a - bb * 0.6);
    const u = abs(t) / a, r = bb * sqrt(max(0.05, 1 - u * u));
    carve(S, X + c * t, B + s * t, r, depth, gid, pid);
  }
}

function sense(S, X, B, th, d, a, g, p) {
  return occAt(S, X + cos(th + a) * d, B + sin(th + a) * d, g, p);
}

// ---- systems
function trySpawn(S) {
  const top = S.bTop + 14, bot = -S.scroll + 90;
  const B = top + rnd() * (bot - top), X = rnd() * W;
  const k4 = S.k[3];
  // a young system has not carved its ground yet, so it keeps others well away; an old one is judged by what it carved
  for (const s of S.systems) {
    let dx = abs(s.x - X);
    if (dx > W / 2) dx = W - dx;
    const dy = s.b - B, f = S.tau - s.born < 70 ? 1 : 0.7;
    const sx = (30 + 2 * k4) * f, sy = (36 - 8 * k4) * f;
    if ((dx / sx) * (dx / sx) + (dy / sy) * (dy / sy) < 1) return;
  }
  for (let dy = -12; dy <= 12; dy += 3)
    for (let dx = -12; dx <= 12; dx += 3) {
      if (dx * dx + dy * dy > 150) continue;
      const bb = B + dy;
      if (bb < S.bTop + 1) return;
      if (S.D[rowF(floor(bb * 2)) * W + (floor(X + dx) & 63)] > 0.05) return;
    }
  const gid = S.nid++;
  // arms: two along the grain at the low end of Form, three to six round the chamber at the high end
  const n = 2 + floor(k4 * (1 + 3.999 * rnd()));
  const rot = PI / 2 + (rnd() - 0.5) * PI * k4 + (rnd() - 0.5) * 0.12;
  const arms = [];
  for (let i = 0; i < n; i++) {
    const th = rot + (2 * PI * i) / n + (rnd() - 0.5) * (0.12 + 0.5 * k4) * (n > 2 ? 1 : 0.3);
    arms.push({ th, len: (22 - 6 * k4) * (0.7 + 0.5 * rnd()), bend: (rnd() - 0.5) * (n > 2 ? 0.08 * k4 : 0.012), star: n > 2 ? k4 : 0 });
  }
  S.systems.push({ x: X, b: B, born: S.tau });
  S.nests.push({ x: X, b: B, r: 1.7 + 0.28 * n, prog: 0, gid, arms });
}

function stepNest(S, N, dt) {
  N.prog += dt / 3;
  const pr = min(1, N.prog);
  if (pr - (N.cut || 0) >= 0.1 || pr >= 1) {
    N.cut = pr;
    carve(S, N.x, N.b, N.r * (0.5 + 0.5 * pr), 1, N.gid, -1);
  }
  if (N.prog >= 1) {
    const sp = 4.0 * pow(S.k[2] < 0 ? 1.9 : 1.4, -S.k[2]);
    for (const a of N.arms) {
      const start = N.r + 1.6 + 1.2 * S.k[3] + 0.6 * rnd();
      S.arms.push({
        x: N.x + cos(a.th) * N.r * 0.6, b: N.b + sin(a.th) * N.r * 0.6, th: a.th, th0: a.th, c: 0,
        L: 0, Lmax: a.len, last: -1, gid: N.gid, sp: sp * (1 - 0.1 * a.star), bend: a.bend, star: a.star,
        next: start + rnd() * sp * 0.4, side: rnd() < 0.5 ? -1 : 1,
      });
    }
    return false;
  }
  return true;
}

function stepArm(S, A, dt) {
  const ds = V_ARM * dt, hw = W_ARM / 2, g = A.gid;
  const near = hw + 1.5, far = hw + 3.4;
  const c0 = sense(S, A.x, A.b, A.th, near, 0, g, -1);
  const l1 = sense(S, A.x, A.b, A.th, near, -0.55, g, -1), r1 = sense(S, A.x, A.b, A.th, near, 0.55, g, -1);
  if (A.L > 1.5 && (c0 || (l1 && r1))) return false;
  const l2 = sense(S, A.x, A.b, A.th, far, -0.3, g, -1), r2 = sense(S, A.x, A.b, A.th, far, 0.3, g, -1);
  A.c += (-A.c / 6) * ds + 0.03 * gauss() * sqrt(ds);
  A.th0 += A.bend * ds;
  A.th += A.c * ds + wrapA(A.th0 - A.th) * 0.3 * ds + ((l1 + 0.5 * l2) - (r1 + 0.5 * r2)) * 0.35 * ds;
  A.x += cos(A.th) * ds;
  A.b += sin(A.th) * ds;
  A.L += ds;
  if (A.b < S.bTop + 2 || A.b > bottomB(S) - 3) return false;
  if (A.L - A.last >= STEP) {
    A.last = A.L;
    carve(S, A.x, A.b, hw, 1, g, -1);
  }
  // egg niches, one side then the other, half the spacing apart
  if (A.L >= A.next) {
    A.next += A.sp * (0.42 + 0.16 * rnd());
    const sg = (A.side = -A.side), nx = -sin(A.th) * sg, nb = cos(A.th) * sg;
    const ex = A.x + nx * (hw + 0.35), eb = A.b + nb * (hw + 0.35);
    carve(S, ex, eb, 0.95, 0.85, g, -1);
    S.eggs.push({ x: ex, b: eb, nx, nb, ax: cos(A.th0), ab: sin(A.th0), t: A.L / A.Lmax, star: A.star, hatch: S.tau + 3 + 4 * rnd(), pid: g });
  }
  return A.L < A.Lmax;
}

function hatch(S, E) {
  const th = atan2(E.nb, E.nx) + (rnd() - 0.5) * 0.5, w1 = W_L1 * (0.88 + 0.24 * rnd());
  const k4 = S.k[3];
  // nothing foreign right where it would start
  if (occAt(S, E.x + E.nx * 2.2, E.b + E.nb * 2.2, -5, E.pid)) return;
  S.larvae.push({
    x: E.x, b: E.b, th, c: 0.1 * gauss(), gid: S.nid++, pid: E.pid,
    L: 0, Lmax: (12.5 - 3.5 * k4) * (1 - 0.35 * E.star) * (0.75 + 0.5 * rnd()), w: W_L0, w1, last: -1,
    nx: E.nx, nb: E.nb, ax: E.ax, ab: E.ab, fan: 0.12 + 0.75 * E.t * E.t + 0.2 * rnd() + 0.9 * E.star,
    turn: 0, turnSum: 0,
  });
}

function endLarva(S, L) {
  const w = L.w, a = 0.8 * w + 0.3, bb = 0.6 * w + 0.1;
  let k = 1;
  for (let tries = 0; tries < 2; tries++) {
    const cx = L.x + cos(L.th) * a * k * 0.5, cb = L.b + sin(L.th) * a * k * 0.5;
    const f = sense(S, cx, cb, L.th, a * k + 1.2, 0, L.gid, L.pid);
    const sl = sense(S, cx, cb, L.th, bb * k + 1.0, -PI / 2, L.gid, L.pid), sr = sense(S, cx, cb, L.th, bb * k + 1.0, PI / 2, L.gid, L.pid);
    if (!f && !sl && !sr) {
      S.pupae.push({ x: cx, b: cb, th: L.th, a: a * k, bb: bb * k, prog: 0, gid: L.gid, pid: L.pid });
      return;
    }
    k = 0.72;
  }
}

function stepLarva(S, L, dt) {
  const ds = V_LARVA * dt, hw = 0.5 * L.w, g = L.gid, p = L.L < 3 ? L.pid : -2;
  const near = hw + 1.4, far = hw + 3.4, side = hw + 1.1;
  const X = L.x, B = L.b, th = L.th;
  const c0 = sense(S, X, B, th, near, 0, g, p);
  const l1 = sense(S, X, B, th, near, -0.6, g, p), r1 = sense(S, X, B, th, near, 0.6, g, p);
  const l2 = sense(S, X, B, th, far, -0.35, g, p), r2 = sense(S, X, B, th, far, 0.35, g, p);
  const ls = sense(S, X, B, th, side, -1.3, g, p), rs = sense(S, X, B, th, side, 1.3, g, p);
  const left = l1 + 0.5 * l2 + 0.7 * ls, right = r1 + 0.5 * r2 + 0.7 * rs;
  if (c0) {
    // something right ahead: turn on the spot toward the freer side, and give up after 75 degrees
    if (L.turn === 0) L.turn = left > right ? 1 : left < right ? -1 : rnd() < 0.5 ? 1 : -1;
    const da = 2.2 * dt;
    L.th += L.turn * da;
    L.turnSum += da;
    L.c = 0;
    if (L.turnSum > 1.05 || (l1 && r1 && L.turnSum > 0.4)) {
      endLarva(S, L);
      return false;
    }
    return true;
  }
  L.turn = 0;
  L.turnSum = max(0, L.turnSum - ds * 0.4);
  L.c += (-L.c / 4) * ds + 0.07 * gauss() * sqrt(ds);
  const fan = L.fan * sm(0, L.Lmax * 0.8, L.L);
  const pref = atan2(L.nb + L.ab * fan, L.nx + L.ax * fan);
  L.th += L.c * ds + wrapA(pref - th) * 0.14 * ds + (left - right) * 0.6 * ds;
  L.x += cos(L.th) * ds;
  L.b += sin(L.th) * ds;
  L.L += ds;
  if (L.b < S.bTop + 2 || L.b > bottomB(S) - 3) return false;
  L.w = W_L0 + (L.w1 - W_L0) * pow(sm(0, L.Lmax, L.L), 0.8);
  if (L.L - L.last >= STEP) {
    L.last = L.L;
    carve(S, L.x, L.b, 0.5 * L.w, 0.72 + 0.28 * sm(0, L.Lmax, L.L), g, L.L < 2.5 ? L.pid : -1);
  }
  if (L.L >= L.Lmax) {
    endLarva(S, L);
    return false;
  }
  return true;
}

function stepPupa(S, P, dt) {
  P.prog += dt / 2.5;
  const pr = min(1, P.prog);
  if (pr - (P.cut || 0) >= 0.12 || pr >= 1) {
    P.cut = pr;
    const k = 0.6 + 0.4 * pr;
    carveOval(S, P.x, P.b, P.th, P.a * k, P.bb * k, 1, P.gid, P.pid);
  }
  return P.prog < 1;
}

function stepStain(S, dt) {
  const G = S.G, GT = S.GT, Q = S.Q, Q2 = S.Q2, tau = S.tau;
  const c0 = (S.bTop + 1) >> 1, c1 = floor(bottomB(S) / 2);
  for (let c = c0; c <= c1; c++) {
    const r = rowC(c) * CW, ru = rowC(c > c0 ? c - 1 : c) * CW, rd = rowC(c < c1 ? c + 1 : c) * CW;
    for (let x = 0; x < CW; x++) {
      const i = r + x, q = Q[i];
      const lap = Q[r + ((x + 1) & 31)] + Q[r + ((x - 1) & 31)] + Q[ru + x] + Q[rd + x] - 4 * q;
      const src = G[i] > 0 ? cl((tau - GT[i] - 35) / 105, 0, 1) : 0;
      Q2[i] = q + dt * (Q_DIFF * lap + Q_RATE * src * (1 - q) - Q_FADE * q);
    }
  }
  for (let c = c0; c <= c1; c++) {
    const r = rowC(c) * CW;
    for (let x = 0; x < CW; x++) Q[r + x] = Q2[r + x];
  }
}

function advance(S, dt) {
  S.tau += dt;
  S.scroll += V_SCROLL * dt;
  const lim = floor(-S.scroll - MT);
  while (S.bTop > lim) {
    S.bTop--;
    woodRow(S, S.bTop);
  }
  S.spawnAcc += dt;
  while (S.spawnAcc >= SPAWN_DT) {
    S.spawnAcc -= SPAWN_DT;
    trySpawn(S);
  }
  S.nests = S.nests.filter((N) => stepNest(S, N, dt));
  S.arms = S.arms.filter((A) => stepArm(S, A, dt));
  if (S.eggs.length) {
    const keep = [];
    for (const E of S.eggs) {
      if (S.tau >= E.hatch) hatch(S, E);
      else keep.push(E);
    }
    S.eggs = keep;
  }
  S.larvae = S.larvae.filter((L) => stepLarva(S, L, dt));
  S.pupae = S.pupae.filter((P) => stepPupa(S, P, dt));
  const gone = -S.scroll + H + 46;
  S.systems = S.systems.filter((s) => s.b < gone);
  S.stainAcc += dt;
  while (S.stainAcc >= STAIN_DT) {
    S.stainAcc -= STAIN_DT;
    stepStain(S, STAIN_DT);
  }
}

export function setup(params) {
  const S = makeState();
  for (let b = S.bTop; b < S.bTop + RL; b++) woodRow(S, b);
  params.s = S;
}

const knobsOf = (input) => {
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  return [cl(kn[0], 0, 1), cl(kn[1], 0.5, 4), cl(kn[2], -1, 1), cl(kn[3], 0, 1)];
};

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = knobsOf(input), d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    S.k = kn.slice();
    // slide the bark from empty until the whole panel is fresh bark carved at every stage
    while (S.scroll < PRE) advance(S, 0.3);
  }
  const e = 1 - exp(-d / 0.3);
  for (let i = 0; i < 4; i++) S.k[i] += (kn[i] - S.k[i]) * e;
  let m = d * S.k[1] * 0.5;
  while (m > 0) {
    const h = min(m, 0.2);
    advance(S, h);
    m -= h;
  }
}

// ---- colour. Five barks: wood light, wood dark, fresh gallery, frass, lit edge, shadow, (stain is fixed)
const KEYS = [
  // pine: warm cream and tan
  [[234, 214, 178], [206, 172, 128], [180, 118, 66], [92, 56, 32], [255, 242, 214], [48, 26, 12]],
  // pale spruce
  [[232, 228, 210], [200, 192, 166], [162, 130, 94], [84, 66, 46], [255, 253, 240], [40, 32, 22]],
  // rose larch
  [[232, 200, 182], [202, 158, 138], [168, 98, 72], [94, 46, 36], [255, 236, 222], [48, 20, 16]],
  // ochre oak
  [[228, 202, 142], [194, 158, 92], [156, 104, 44], [88, 56, 24], [252, 236, 186], [42, 26, 10]],
  // grey weathered wood
  [[206, 202, 192], [162, 156, 144], [124, 108, 92], [66, 56, 48], [244, 242, 236], [28, 26, 24]],
];
const STAIN = [104, 128, 152], STAIN_D = [44, 56, 74];
function paletteAt(S, hue) {
  if (abs(S.palAt - hue) < 1e-4) return;
  const p = hue * 5, i = floor(p) % 5, u = sm(0, 1, p - floor(p)), a = KEYS[i], b = KEYS[(i + 1) % 5];
  for (let k = 0; k < 6; k++) for (let c = 0; c < 3; c++) S.pal[k * 3 + c] = a[k][c] + (b[k][c] - a[k][c]) * u;
  S.palAt = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  paletteAt(S, S.k[0]);
  const P = S.pal, D = S.D, T = S.T, WT = S.WT, FM = S.FM, Q = S.Q, col = S.col, qrow = S.qrow, tau = S.tau;
  const A0 = P[0], A1 = P[1], A2 = P[2], B0 = P[3], B1 = P[4], B2 = P[5];
  const F0 = P[6], F1 = P[7], F2 = P[8], R0 = P[9], R1 = P[10], R2 = P[11];
  const E0 = P[12], E1 = P[13], E2 = P[14], K0 = P[15], K1 = P[16], K2 = P[17];
  const u0 = -2 * S.scroll, m0 = floor(u0), phi = u0 - m0;
  for (let j = 0; j < 257; j++) {
    const m = m0 + j, ri = rowF(m) * W, ru = rowF(m - 1) * W, rd = rowF(m + 1) * W;
    // the stain for this half row, across x at 2 LED cells
    const cy = (m + 0.5) / 4 - 0.5, cyi = floor(cy), fy = cy - cyi;
    const qa = rowC(cyi) * CW, qb = rowC(cyi + 1) * CW;
    for (let x = 0; x < CW; x++) qrow[x] = Q[qa + x] + (Q[qb + x] - Q[qa + x]) * fy;
    let o = j * W * 3;
    for (let x = 0; x < W; x++, o += 3) {
      const i = ri + x;
      const qx = (x + 0.5) / 2 - 0.5, qxi = floor(qx), fx = qx - qxi;
      const q0 = qrow[qxi & 31], q = cl(q0 + (qrow[(qxi + 1) & 31] - q0) * fx, 0, 1);
      const t = WT[i];
      let r = B0 + (A0 - B0) * t, g = B1 + (A1 - B1) * t, b = B2 + (A2 - B2) * t;
      const qs = sm(0.03, 1, q) * 0.66;
      if (qs > 0.003) {
        const k = 0.86 + 0.28 * t;
        r += (STAIN[0] * k - r) * qs;
        g += (STAIN[1] * k - g) * qs;
        b += (STAIN[2] * k - b) * qs;
      }
      const d = D[i];
      if (d > 0.02) {
        const age = tau - T[i], fr = sm(6, 60, age), mo = 1 + 0.22 * FM[i] * fr;
        let gr = (F0 + (R0 - F0) * fr) * mo, gg = (F1 + (R1 - F1) * fr) * mo, gb = (F2 + (R2 - F2) * fr) * mo;
        const qd = qs * 0.6 * fr;
        gr += (STAIN_D[0] - gr) * qd;
        gg += (STAIN_D[1] - gg) * qd;
        gb += (STAIN_D[2] - gb) * qd;
        const wg = sm(0.1, 0.72, d);
        r += (gr - r) * wg;
        g += (gg - g) * wg;
        b += (gb - b) * wg;
      }
      // light from the upper left: D rising toward the light is a wall in shadow, falling toward it a lit edge
      const ddx = (D[ri + ((x + 1) & 63)] - D[ri + ((x - 1) & 63)]) * 0.5;
      const ddy = D[rd + x] - D[ru + x];
      const sh = -(0.6 * ddx + 0.8 * ddy) * 1.5;
      if (sh > 0.01) {
        const k = sh > 0.8 ? 0.8 : sh;
        r += (E0 - r) * k;
        g += (E1 - g) * k;
        b += (E2 - b) * k;
      } else if (sh < -0.01) {
        const k = sh < -0.85 ? 0.85 : -sh;
        r += (K0 - r) * k;
        g += (K1 - g) * k;
        b += (K2 - b) * k;
      }
      col[o] = r;
      col[o + 1] = g;
      col[o + 2] = b;
    }
  }
  const wa = (1 - phi) * 0.5, wc = phi * 0.5;
  for (let y = 0; y < H; y++) {
    const oa = 2 * y * W * 3, ob = oa + W * 3, oc = ob + W * 3;
    for (let x = 0; x < W; x++) {
      const k = x * 3;
      const r = col[oa + k] * wa + col[ob + k] * 0.5 + col[oc + k] * wc;
      const g = col[oa + k + 1] * wa + col[ob + k + 1] * 0.5 + col[oc + k + 1] * wc;
      const b = col[oa + k + 2] * wa + col[ob + k + 2] * 0.5 + col[oc + k + 2] * wc;
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
