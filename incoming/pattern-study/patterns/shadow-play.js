// ===== Patternflow pattern =====
// Title:   Shadow Play
// Family:  stage
// Idea:    Wayang kulit from the audience: an oil lamp behind the white screen throws the lacy leather shadows of a knight and an ogre who meet, threaten and fight until the ogre is flung away, then the leaf-shaped gunungan sweeps in trembling to close the scene and open the next.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the Javanese wayang kulit shadow play
// Round:   26
// ===============================
// @matrix 64x128
// @knobs View=0..1, Speed=0.2..3, Lamp=0..1, Flicker=0..1
//
// Knob 1: View. At 0 you sit in front of the screen: black lace shadows on warm cloth. Turned up you go round to the dalang's side, where the same puppets show their gold, red and indigo paint under the hanging lamp.
// Knob 2: Speed. The pace of the play: at 2 a scene, from the gunungan leaving the middle to the gunungan planted there again, takes 14.4 s; at 0.2 ten times slower.
// Knob 3: Lamp. How close the blencong hangs to the screen. At 0 it is far back and the shadows are sharp. Turned up, the hot spot tightens, the corners go dark, and every shadow grows and blurs.
// Knob 4: Flicker. How much the oil flame gutters and sways. At 0.06 the light breathes; at 1 a draught makes it jump and swing, and the shadows soften.
// Buttons: K1 tap: the dalang strikes the cempala; the knight lunges, the ogre reels (or the gunungan shivers) and the screen shakes.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, sqrt, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Rows: the top beam, the cloth, the line the puppets stand on, the hem, the banana trunk, the first row the audience can reach.
const BEAM = 3, CLOTH = 10, GROUND = 92, HEM = 103, TRUNK = 104, AUD = 88;
// One scene in story seconds (real seconds at Speed 2).
const SCENE = 14.4;
// The paint, seen from the dalang's side.
const GOLD = [0.95, 0.72, 0.26], RED = [0.86, 0.2, 0.13], INDIGO = [0.22, 0.3, 0.8], TEAL = [0.1, 0.52, 0.48], HAIR = [0.13, 0.1, 0.15];
const HORN = [0.32, 0.2, 0.11], BAMBOO = [0.62, 0.5, 0.3], IVORY = [0.96, 0.92, 0.82];
// Lace: the punched holes, as a lattice in puppet space: spacing along, spacing across, laid diagonally.
const LA = [0, 2.5, 2.0, 1.9, 2.3], LB = [0, 2.5, 3.6, 1.9, 2.3], LD = [0, 0, 1, 0, 0], LR = [0, 0.9, 0.9, 0.8, 1.15];

// Knight and ogre outlines in puppet space: x forward, y up from the soles.
const K_TORSO = [-5.2, 40.4, -3.6, 41.6, 3.2, 41.6, 4.6, 40.4, 3.4, 35, 1.9, 28.5, -2.1, 28.5, -3.6, 35];
const K_KAIN = [-3.2, 28.5, 3.2, 28.5, 4.4, 20, 3.4, 13, 1.6, 5, -0.6, 13, -4.5, 16, -9.8, 9.5, -5.8, 22];
const K_NOSE = [3.8, 49.6, 8.6, 45.2, 4.6, 46.4];
const O_TORSO = [-8.2, 47, -6.5, 48.4, 6, 48.4, 7.8, 46.5, 7, 38, 5.5, 31, -5.5, 31, -7.5, 39];
const O_KAIN = [-6.2, 31.5, 6.2, 31.5, 8.8, 21.5, 2, 17, -4, 19.5, -10, 23];
const O_CROWN = [-0.5, 58.5, 6.2, 58.5, 5.4, 62, 2.8, 67, 0.2, 61.8];

// Seconds of a scene: when each puppet enters, and where it goes.
const KX = [1.7, -16, 3.6, 18, 5.6, 14, 6, 23, 6.4, 14, 6.8, 17, 7.2, 13, 7.6, 24, 8, 16, 8.5, 20, 9, 22, 10.8, 28, 12.3, 86];
const OX = [2.3, 84, 4.2, 47, 5.6, 50, 6, 47, 6.4, 49, 6.8, 40, 7.2, 50, 7.6, 47, 8, 39, 8.5, 42, 9, 40];
function key(t, k) {
  if (t <= k[0]) return k[1];
  for (let i = 2; i < k.length; i += 2) if (t < k[i]) return mix(k[i - 1], k[i + 1], sm(k[i - 2], k[i], t));
  return k[k.length - 1];
}
const pose = (hc, sz) => ({ on: false, x: 32, y: GROUND, z: 0.02, rot: 0, face: 1, a1: 0, a2: 0, b1: 0, b2: 0, jaw: 0, hc, sz });

export function setup(params) {
  const R = () => Math.random() * TAU;
  const P = (params.s = {
    M: new Float32Array(N), A: new Float32Array(N), C: new Float32Array(N * 3), F: new Float32Array(N * 3),
    BG: new Float32Array(N * 3), PT: new Uint8Array(N), LW: new Float32Array(81), HB: new Float32Array((H - AUD) * W),
    t: 0, rt: 0, view: 0, lamp: 0, fl: 0.06, knock: -1, ph: [R(), R(), R(), R(), R(), R(), R()], dir: Math.random() < 0.5 ? 1 : -1,
    K: pose(28, 1.22), O: pose(32, 1.12), G: pose(0, 1.04), I: 1, bil: 0, LX: 31.5, LY: 46, flame: 7, shx: 0, shy: 0,
  });
  // The puppets planted in the trunk at either end of the screen, only their fronts showing: an ogre king, a knight.
  P.SIMP = [[-6.5, 1, 1.32, 0], [65.5, -1, 1.4, 1]].map(([x, face, sz, k]) => Object.assign(pose(30, sz), { x, face, k, y: GROUND + 4, a2: 0.1, b1: -0.1, b2: 0.15 }));
  // Half the gunungan's width at each height: a leaf with a pointed tip.
  for (let v = 0; v <= 80; v++) P.LW[v] = v > 78 ? 0 : v < 22 ? 18 * sqrt(1 - ((22 - v) / 31) ** 2) : 18 * (1 - ((v - 22) / 56) ** 1.7) ** 1.15;
  // What does not move, as colour before the light: beam, border, posts, cloth, hem, trunk, floor.
  const B = P.BG;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, n = hash(x, y);
    let c = [0.02, 0.018, 0.03], t = 1;
    if (y >= BEAM && y < BEAM + 4) {
      const g = [0.55, 0.85, 1, 0.65][y - BEAM] * ((x + (y & 1) * 2) % 5 === 0 ? 0.55 : 0.9 + 0.1 * n);
      c = [0.5 * g, 0.31 * g, 0.16 * g];
    } else if (y >= BEAM + 4 && y < CLOTH) c = y === CLOTH - 1 ? (x & 1 ? [0.85, 0.62, 0.24] : [0.3, 0.07, 0.06]) : [0.34, 0.07, 0.06].map((v) => v * (0.85 + 0.15 * n));
    else if (y >= CLOTH && y < HEM && (x < 2 || x > 61)) {
      const g = x === 1 || x === 62 ? 0.75 : 0.42;
      c = [0.46 * g, 0.28 * g, 0.15 * g];
    } else if (y >= CLOTH && y < HEM) (t = 0), (c = [0.955 + 0.045 * n - (y === 57 ? 0.07 : y === 58 ? 0.025 : 0) - (x & 1 ? 0.012 : 0), 0, 0]);
    else if (y === HEM) c = [0.3, 0.06, 0.05];
    else if (y >= TRUNK && y < TRUNK + 8) {
      const g = [0.7, 1, 0.95, 0.85, 0.72, 0.58, 0.44, 0.3][y - TRUNK] * (0.82 + 0.18 * hash(floor(x / 4) + y * 17, y));
      (t = 2), (c = [0.6 * g, 0.64 * g, 0.4 * g]);
    } else if (y >= TRUNK + 8) c = [0.05, 0.035, 0.03].map((v) => v * (1 - (y - TRUNK - 8) / 20));
    (B[o] = c[0]), (B[o + 1] = c[1]), (B[o + 2] = c[2]), (P.PT[i] = t);
  }
}

// The knight's scene, in story seconds, for a scene that runs left to right.
function knight(t, Q, rt, kb) {
  Q.on = t > 1.7 && t < 12.3;
  Q.x = key(t, KX);
  const v = (key(t + 0.05, KX) - key(t - 0.05, KX)) * 10, walk = cl(abs(v) / 12, 0, 1), st = sin(PI * t * 2.6);
  const fight = sm(5.5, 5.8, t) * (1 - sm(8.6, 8.9, t)), w = TAU * 1.6 * (t - 5.6), reach = fight * cl((Q.x - 14) / 9, 0, 1);
  const point = sm(3.7, 4.1, t) * (1 - sm(4.8, 5.2, t)), heave = sm(8.5, 9.1, t) * (1 - sm(9.7, 10.5, t));
  Q.y = GROUND - walk * 1.8 * abs(st);
  Q.z = 0.03;
  Q.rot = -0.05 * walk + fight * 0.06 * sin(w + 0.5) + heave * 0.16 - 0.14 * kb;
  Q.a1 = 0.12 + 0.3 * walk * st + 1.45 * point + fight * 0.7 + 1.5 * reach + 2.5 * heave + 1.4 * kb;
  Q.a2 = 0.15 + 0.35 * point + fight * 0.9 - 0.7 * reach + 0.2 * heave;
  Q.b1 = -0.12 + 0.06 * sin(rt * 1.7) - 0.25 * walk * st + fight * 0.3 * sin(w + 2);
  Q.b2 = 0.2;
}

// The ogre: in from the other side, a looming threat, the fight, the throw.
function ogre(t, Q, rt, kb) {
  Q.on = t > 2.3 && t < 10.6;
  const u = cl((t - 9.2) / 1.4, 0, 1);
  Q.x = key(t, OX) + 30 * u;
  const v = (key(t + 0.05, OX) - key(t - 0.05, OX)) * 10, walk = cl(abs(v) / 12, 0, 1) * (1 - u), st = sin(PI * t * 2.1);
  const fight = sm(5.5, 5.8, t) * (1 - sm(8.6, 8.9, t)), w = TAU * 1.6 * (t - 5.6), reach = fight * cl((50 - Q.x) / 10, 0, 1);
  const loom = sm(4.3, 4.9, t) * (1 - sm(4.95, 5.5, t));
  Q.y = GROUND - walk * 2.6 * abs(st) - 115 * u * u;
  Q.z = 0.03 + 0.16 * loom + 0.28 * u;
  Q.rot = -0.04 * walk + 0.07 * walk * st - 0.1 * loom + fight * 0.07 * sin(w + 3.6) + 5.6 * u + 0.35 * kb;
  Q.a1 = 0.3 + 0.25 * walk * st + 2.0 * loom + fight * (0.6 + 0.3 * sin(w)) + 1.6 * reach + 1.2 * u;
  Q.a2 = 0.35 + 0.5 * loom + fight * 0.6 - 0.5 * reach;
  Q.b1 = -0.4 - 0.3 * walk * st + 0.5 * loom; Q.b2 = 0.5;
  Q.jaw = 0.08 + loom * (0.25 + 0.15 * sin(rt * 14)) + fight * 0.25 * (0.5 + 0.5 * sin(w * 2)) + 0.45 * u + 0.4 * kb;
}

// The gunungan: planted in the middle, pulled away trembling, back at the end.
function gunungan(t, Q, rt, kb) {
  Q.on = t < 3.3 || t > 10.5;
  let e, mv;
  if (t < 7) (e = cl((t - 1.4) / 1.9, 0, 1) ** 2), (Q.x = 32 + 58 * e), (mv = sin(PI * cl((t - 1.4) / 1.9, 0, 1)));
  else (e = 1 - sm(10.5, 12.6, t)), (Q.x = 32 - 58 * e), (mv = sin(PI * e));
  Q.y = 98 - 10 * mv;
  Q.z = 0.02 + 0.3 * e;
  Q.rot = -0.45 * e + (0.012 + 0.06 * mv + 0.12 * kb) * sin(rt * TAU * 8.5) + 0.01 * sin(rt * 2.3);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], rd = cl(dt || 0, 0, 0.05);
  (P.view = cl(k[0], 0, 1)), (P.lamp = cl(k[2], 0, 1)), (P.fl = cl(k[3], 0, 1));
  (P.rt += rd), (P.t += (rd * cl(k[1], 0.2, 3)) / 2);
  if (input.btnPressed && input.btnPressed[0]) P.knock = 0;
  if (P.knock >= 0 && (P.knock += rd) > 1.2) P.knock = -1;
  const kn = P.knock < 0 ? 9 : P.knock, kb = kn < 0.45 ? sin((PI * kn) / 0.45) : 0, kr = sin(PI * cl((kn - 0.1) / 0.5, 0, 1)), sh = kn < 0.4 ? 1 - kn / 0.4 : 0;
  // The flame: a breathing flicker, now and then a gutter, a sway that moves the light.
  const f = P.fl, rt = P.rt, ph = P.ph, amp = 0.035 + 0.2 * f;
  const n = 0.5 * sin(7.3 * rt + ph[0]) + 0.3 * sin(12.9 * rt + ph[1]) + 0.2 * sin(23.1 * rt + ph[2]), gut = max(0, sin(1.7 * rt + ph[3]) + 0.6 * sin(3.1 * rt + ph[6])) ** 3 * 0.25 * f;
  P.I = 1 - 0.12 * f + amp * n - 0.35 * gut + 0.2 * sh;
  // A draught also bellies the cloth away from the puppets, so their shadows swell and soften.
  P.bil = 0.07 * f * (0.6 + 0.4 * sin(0.9 * rt + ph[5]));
  P.LX = 31.5 + (1 + 11 * f) * (0.65 * sin(2.1 * rt + ph[4]) + 0.35 * sin(0.83 * rt + ph[5])) + 2 * amp * sin(9.7 * rt + ph[6]);
  P.LY = 46 - 3 * gut - 3 * f * sin(1.3 * rt + ph[2]);
  P.flame = 7 * (1 + 1.5 * f) * (1 + 0.8 * amp * sin(11.3 * rt + ph[1]) + 0.6 * gut);
  (P.shx = 1.3 * sh * sin(kn * 70)), (P.shy = 0.9 * sh * sin(kn * 53 + 1));
  // The play.
  const sc = floor(P.t / SCENE), t = P.t - sc * SCENE, dir = sc & 1 ? -P.dir : P.dir;
  (P.K.face = dir), (P.O.face = -dir), (P.G.face = dir);
  knight(t, P.K, rt, kb), ogre(t, P.O, rt, kr), gunungan(t, P.G, rt, sh);
  (P.K.x += 7 * kb), (P.O.x += 6 * kr);
  for (const Q of [P.K, P.O, P.G]) if (dir < 0) Q.x = 63 - Q.x;
}

// The puppet being drawn: screen from puppet space and back, its magnification and blur.
let M, A, C, TX, TY, F11, F12, F21, F22, I11, I12, I21, I22, MAG, PEN, HV, LC;
function place(P, Q, D) {
  const f = cl((Q.z + P.bil) / D, 0, 0.62), m = 1 / (1 - f), c = cos(Q.rot), s = sin(Q.rot), fc = Q.face, k = m * Q.sz, hc = Q.hc * Q.sz;
  (MAG = k), (PEN = 1 + (P.flame * f) / (1 - f)), (HV = cl(1.25 - 0.42 * PEN, 0, 0.85));
  (F11 = k * fc * c), (F12 = -k * fc * s), (F21 = -k * s), (F22 = -k * c);
  TX = P.LX * (1 - m) + m * (Q.x + fc * s * hc) + P.shx;
  TY = P.LY * (1 - m) + m * (Q.y - hc + c * hc) + P.shy;
  const det = F11 * F22 - F12 * F21;
  (I11 = F22 / det), (I12 = -F12 / det), (I21 = -F21 / det), (I22 = F11 / det);
}

function holes(u, v, k) {
  let a = u, b = v;
  if (LD[k]) (a = (u + v) * 0.7071), (b = (v - u) * 0.7071);
  if (k === 4) (a += 0.8 * sin(v * 0.6 + abs(u) * 0.35)), (b += 0.5 * sin(abs(u) * 0.7));
  const pa = LA[k], pb = LB[k], j = round(b / pb), aa = a + (j & 1) * pa * 0.5, du = aa - round(aa / pa) * pa, dv = b - j * pb;
  return cl((LR[k] - sqrt(du * du + dv * dv)) * 1.15 + 0.1, 0, 1);
}

// The gunungan's inside: rim, gate, tree, the two beasts, and lace everywhere else.
let LN, LW;
function leaf(u, v, hw) {
  const au = abs(u);
  (LN = 0), (LC = GOLD);
  if (hw - au < 1.4 || v < 1.3) return (LC = RED), 1;
  if (v < 15 && au < 8) {
    if (v < 9) return (LC = RED), au > 1 && au < 3.3 && v > 2.2 && v < 7.6 ? 0.12 : 1;
    return au < 8 - (v - 9) * 1.15 ? 1 : ((LN = 4), (LC = TEAL), 1);
  }
  if (au < 1.9 - v * 0.012 && v < 70) return 1;
  for (let b = 0; b < 6; b++) {
    const vb = 19 + 8 * b + 0.5 * au + 0.02 * au * au;
    if (abs(v - vb) < 1.05 && au < min(hw - 2.4, 15 - b)) return 1;
  }
  const bx = (au - 6.5) / 3.4, by = (v - 17.5) / 1.9;
  if (bx * bx + by * by < 1) return (LC = HORN), 1;
  return (LN = 4), (LC = TEAL), 1;
}

// One part: kind 0 a tapered rod (x0, y0, x1, y1, r0, r1), 1 an ellipse (cx, cy, rx, ry, turn), 2 a polygon, 3 the gunungan's leaf.
// lace picks the holes; a part with no colour is a hole cut through what is already there (lace is then how deep).
function part(k, a, b, c, d, e, f, lace, col) {
  let u0, u1, v0, v1, rp = 99;
  const ce = cos(e || 0), se = sin(e || 0);
  if (k === 0) {
    const r = max(e, f);
    (u0 = min(a, c) - r), (u1 = max(a, c) + r), (v0 = min(b, d) - r), (v1 = max(b, d) + r), (rp = r * MAG);
  } else if (k === 1) {
    const r = max(c, d);
    (u0 = a - r), (u1 = a + r), (v0 = b - r), (v1 = b + r), (rp = min(c, d) * MAG);
  } else if (k === 2) {
    (u0 = v0 = 1e9), (u1 = v1 = -1e9);
    for (let i = 0; i < a.length; i += 2) (u0 = min(u0, a[i])), (u1 = max(u1, a[i])), (v0 = min(v0, a[i + 1])), (v1 = max(v1, a[i + 1]));
  } else (u0 = -19), (u1 = 19), (v0 = 0), (v1 = 79);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let q = 0; q < 4; q++) {
    const u = q & 1 ? u1 : u0, v = q & 2 ? v1 : v0, X = F11 * u + F12 * v + TX, Y = F21 * u + F22 * v + TY;
    (x0 = min(x0, X)), (x1 = max(x1, X)), (y0 = min(y0, Y)), (y1 = max(y1, Y));
  }
  const pad = PEN * 0.5 + 0.5, thin = min(1, (2 * rp + 1) / PEN), abx = c - a, aby = d - b, ab2 = abx * abx + aby * aby || 1e-9;
  const xa = max(0, floor(x0 - pad)), xb = min(W - 1, ceil(x1 + pad)), ya = max(0, floor(y0 - pad)), yb = min(H - 1, ceil(y1 + pad));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x - TX, dy = y - TY, u = I11 * dx + I12 * dy, v = I21 * dx + I22 * dy;
      let dd, op = 1, ln = lace, cc = col;
      if (k === 0) {
        const t = cl(((u - a) * abx + (v - b) * aby) / ab2, 0, 1), qx = u - a - abx * t, qy = v - b - aby * t;
        dd = sqrt(qx * qx + qy * qy) - mix(e, f, t);
      } else if (k === 1) {
        const pu = u - a, pv = v - b, lu = (pu * ce + pv * se) / c, lv = (pv * ce - pu * se) / d;
        dd = (sqrt(lu * lu + lv * lv) - 1) * min(c, d);
      } else if (k === 2) {
        let md = 1e9, ins = false;
        for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
          const xi = a[i], yi = a[i + 1], ex = a[j] - xi, ey = a[j + 1] - yi;
          if (yi > v !== a[j + 1] > v && u < (ex * (v - yi)) / ey + xi) ins = !ins;
          const s = cl(((u - xi) * ex + (v - yi) * ey) / (ex * ex + ey * ey), 0, 1), qx = u - xi - ex * s, qy = v - yi - ey * s;
          md = min(md, qx * qx + qy * qy);
        }
        dd = ins ? -sqrt(md) : sqrt(md);
      } else {
        const vi = cl(v, 0, 79.9), v0i = floor(vi), hw = mix(LW[v0i], LW[v0i + 1], vi - v0i);
        dd = max(abs(u) - hw, -v, v - 78);
        if (dd < 0.6) (op = leaf(u, v, hw)), (ln = LN), (cc = LC);
      }
      const dp = dd * MAG;
      if (dp > pad) continue;
      let cs = cl(0.5 - dp / PEN, 0, 1) * thin, cv = cl(0.5 - dp, 0, 1);
      const i = y * W + x, o = i * 3;
      if (!cc) {
        const dep = lace < 0 ? 0.9 * holes(u, v, -lace) : lace, s = 1 - cs * dep * min(1, HV * 1.3), sv = 1 - cv * dep;
        (M[i] *= s), (A[i] *= sv), (C[o] *= sv), (C[o + 1] *= sv), (C[o + 2] *= sv);
        continue;
      }
      if (ln) {
        const h = holes(u, v, ln);
        (cs *= 1 - h * HV), (cv *= 1 - h * 0.85);
      }
      cs *= op;
      cv *= op;
      if (cs > M[i]) M[i] = cs;
      if (cv > 0) (C[o] += (cc[0] - C[o]) * cv), (C[o + 1] += (cc[1] - C[o + 1]) * cv), (C[o + 2] += (cc[2] - C[o + 2]) * cv), (A[i] += (1 - A[i]) * cv);
    }
}
const rod = (x0, y0, x1, y1, r0, r1, lace, col) => part(0, x0, y0, x1, y1, r0, r1, lace, col);
const ell = (cx, cy, rx, ry, turn, lace, col) => part(1, cx, cy, rx, ry, turn, 0, lace, col);
const poly = (pts, lace, col) => part(2, pts, 0, 0, 0, 0, 0, lace, col);

// An arm on its two joints, the pointing hand, and the thin rod down to the dalang's fist.
function arm(sx, sy, a1, a2, l1, l2, r1, r2, col) {
  const ex = sx + l1 * sin(a1), ey = sy - l1 * cos(a1), hx = ex + l2 * sin(a1 + a2), hy = ey - l2 * cos(a1 + a2);
  rod(sx, sy, ex, ey, r1, r1 * 0.85, 0, col), rod(ex, ey, hx, hy, r2 * 0.95, r2 * 0.75, 0, col);
  rod(hx, hy, hx + 2.4 * sin(a1 + a2 + 0.25), hy - 2.4 * cos(a1 + a2 + 0.25), r2 * 0.75, 0.3, 0, col);
  rod(ex - 0.2, ey, ex + 0.2, ey, r1 * 1.15, r1 * 1.15, 0, GOLD);
  const gx = 2 - hx, gy = -14 - hy, l = sqrt(gx * gx + gy * gy) || 1, L = min(l, 30) / l;
  rod(hx, hy, hx + gx * L, hy + gy * L, 0.42, 0.42, 0, BAMBOO);
}

function drawKnight(Q) {
  rod(0.4, 34, 0.4, -16, 0.5, 0.45, 0, HORN);
  arm(-4.6, 39.4, Q.b1, Q.b2, 12, 12.5, 1.0, 0.85, GOLD);
  rod(-1, 17, -2.6, 1.5, 1.15, 0.95, 0, GOLD), rod(-2.6, 0.8, 1.2, 0.6, 0.8, 0.7, 0, GOLD);
  rod(1.5, 17, 3.6, 1.5, 1.15, 0.95, 0, GOLD), rod(3.6, 0.8, 7.6, 0.6, 0.8, 0.7, 0, GOLD);
  poly(K_KAIN, 2, INDIGO);
  rod(3, 27, 5.4, 11, 0.8, 0.45, 0, RED);
  poly(K_TORSO, 0, GOLD);
  rod(-2.6, 29, 2.4, 29, 1.1, 1.1, 0, RED);
  rod(-2.2, 33, 2, 33, 0.9, 0.9, -1, null);
  rod(0.5, 40.5, 1.8, 44, 1.3, 1.1, 0, GOLD);
  ell(-1.6, 46, 1.1, 2.6, -0.5, 1, GOLD);
  ell(2.2, 47, 2.8, 3.6, 0.35, 0, GOLD);
  poly(K_NOSE, 0, GOLD);
  rod(1.5, 50.5, -2.5, 53.4, 1.6, 1.4, 3, HAIR), rod(-2.5, 53.4, -4.8, 50.2, 1.4, 0.6, 3, HAIR);
  rod(-0.5, 50, 4.2, 50.6, 0.7, 0.6, 0, GOLD);
  rod(3.6, 48, 5.1, 47.6, 0.38, 0.38, 0.9, null);
  rod(-3.4, 38.6, 0.3, 36.6, 0.75, 0.75, -3, null), rod(0.3, 36.6, 3.4, 38.6, 0.75, 0.75, -3, null);
  arm(3.6, 39.4, Q.a1, Q.a2, 12, 12.5, 1.0, 0.85, GOLD);
}

function drawOgre(Q) {
  rod(0.4, 40, 0.4, -16, 0.55, 0.5, 0, HORN);
  arm(-7.5, 46, Q.b1, Q.b2, 12.5, 13, 1.6, 1.3, RED);
  rod(-3, 27, -7, 15, 2, 1.6, 0, RED), rod(-7, 15, -7.5, 2, 1.6, 1.3, 0, RED), rod(-8.1, 1, -3.6, 0.8, 1.1, 1, 0, RED);
  rod(3, 27, 7, 15, 2, 1.6, 0, RED), rod(7, 15, 7.5, 2, 1.6, 1.3, 0, RED), rod(7.5, 1, 12, 0.8, 1.1, 1, 0, RED);
  poly(O_KAIN, 2, TEAL);
  rod(5, 29, 8, 10, 1, 0.6, 0, GOLD);
  poly(O_TORSO, 0, RED), ell(3.6, 37, 4.8, 5.4, 0, 0, RED);
  rod(-5.5, 45.6, 0.5, 42.5, 1, 1, -3, null), rod(0.5, 42.5, 6, 45.6, 1, 1, -3, null), ell(-1.5, 38, 3, 4, 0.2, -1, null);
  rod(-6, 31.2, 6, 31.2, 1.2, 1.2, 0, GOLD);
  ell(-3.5, 54, 5.5, 7.5, 0.35, 3, HAIR);
  rod(-6, 59, -10.5, 63, 1.3, 0.3, 0, HAIR), rod(-8, 52, -13, 50, 1.3, 0.3, 0, HAIR), rod(-6.5, 47.5, -10.5, 43, 1.1, 0.3, 0, HAIR);
  rod(0.5, 47, 2, 51, 2.5, 2.2, 0, RED);
  ell(3.2, 55.3, 5, 4.4, 0, 0, RED), ell(9.3, 54.8, 2.4, 2.0, 0, 0, RED);
  const j = Q.jaw, jx = 3.5 + 6.3 * cos(j), jy = 50.6 - 6.3 * sin(j);
  rod(3.5, 50.6, jx, jy, 1.3, 1.0, 0, RED), rod(jx - 0.9, jy + 0.5, jx - 0.5, jy + 2.7, 0.55, 0.15, 0, IVORY);
  rod(7.6, 51.3, 7.9, 49.3, 0.5, 0.15, 0, IVORY);
  poly(O_CROWN, 1, GOLD);
  ell(-0.5, 53, 1.5, 3, -0.4, 1, GOLD);
  rod(6.3, 56.4, 6.3, 56.4, 1.5, 1.5, 0.9, null);
  rod(6.6, 56.4, 6.6, 56.4, 0.6, 0.6, 0, HAIR);
  arm(6, 46, Q.a1, Q.a2, 12.5, 13, 1.6, 1.3, RED);
}

function drawGunungan() {
  rod(0, 6, 0, -12, 0.7, 0.6, 0, HORN);
  part(3, 0, 0, 0, 0, 0, 0, 0, GOLD);
}

// A soft-edged ellipse painted over the frame, or added as glow.
function blob(F, cx, cy, rx, ry, col, a, add) {
  for (let y = max(0, floor(cy - ry - 1)); y <= min(H - 1, ceil(cy + ry + 1)); y++)
    for (let x = max(0, floor(cx - rx - 1)); x <= min(W - 1, ceil(cx + rx + 1)); x++) {
      const ex = (x - cx) / rx, ey = (y - cy) / ry, d = sqrt(ex * ex + ey * ey), o = (y * W + x) * 3;
      const c = add ? max(0, 1 - d) ** 2 * a : cl((1 - d) * min(rx, ry) + 0.5, 0, 1) * a;
      for (let j = 0; j < 3; j++) F[o + j] = add ? F[o + j] + col[j] * c : mix(F[o + j], col[j], c);
    }
}

// The audience: heads and shoulders against the light, [x, top, rx, ry, kind]: bare, a peci cap, a headscarf.
const RIM = [1, 0.76, 0.48];
const HEADS = [[6, 98, 4.6, 5.6, 1], [19, 95, 5, 6, 0], [33, 99.5, 4.4, 5.4, 2], [46, 96, 5, 6.2, 1], [58.5, 98.5, 4.6, 5.6, 0]];
// Their outline, as coverage in rows AUD and down: head, ears or scarf, neck, shoulders.
function audience(HB, rt) {
  HB.fill(0);
  for (let j = 0; j < 5; j++) {
    const [hx, ht, rx, ry, kd] = HEADS[j], cx = hx + 0.6 * sin(rt * 0.45 + j * 1.7), top = ht + 0.4 * sin(rt * 0.7 + j * 2.3), cy = top + ry, sr = rx * 2.6;
    for (let y = floor(top - 3); y < H; y++)
      for (let x = max(0, floor(cx - sr)); x <= min(W - 1, ceil(cx + sr)); x++) {
        const ax = abs(x - cx), ex = ax / (rx + (kd === 2 ? 0.8 : 0)), ey = (y - cy) / ry, sx = ax / sr, sy = (y - top - 2 * ry - 11) / 9;
        let d = min((sqrt(ex * ex + ey * ey) - 1) * rx, (sqrt(sx * sx + sy * sy) - 1) * 9);
        if (kd === 1) d = min(d, max(ax - rx * (0.86 + 0.04 * (y - top)), abs(y - top + 0.2) - 2.3));
        if (kd === 2) d = min(d, max(ax - rx * (0.9 + (y - cy) * 0.09), cy - y));
        else d = min(d, (sqrt((ax - rx) ** 2 + (y - cy - 0.6) ** 2) - 1.1) * 1.5, max(ax - rx * 0.62, cy - y));
        const i = (y - AUD) * W + x;
        HB[i] = max(HB[i], cl(0.5 - d, 0, 1));
      }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  (M = P.M), (A = P.A), (C = P.C), (LW = P.LW);
  M.fill(0), A.fill(0), C.fill(0);
  const D = 1 - 0.55 * P.lamp;
  for (const S of P.SIMP) place(P, S, D), S.k ? drawKnight(S) : drawOgre(S);
  if (P.K.on) place(P, P.K, D), drawKnight(P.K);
  if (P.O.on) place(P, P.O, D), drawOgre(P.O);
  if (P.G.on) place(P, P.G, D), drawGunungan();
  const F = P.F, B = P.BG, PT = P.PT, I = P.I, LX = P.LX, LY = P.LY, R2 = (46 * D) ** 2, vw = sm(0, 1, P.view), rd = 0.12 * (1 - P.I) * P.fl, top = I * 228 * (0.95 + 0.05 / D);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, dx = x - LX, dy = y - LY, fo = 1 / (1 + (dx * dx + dy * dy) / R2), pt = PT[i];
      if (pt === 0) {
        // The cloth: lamp light through cotton, the shadows on it; or from behind, the paint over the dim cloth.
        const L = top * (0.2 + 0.8 * fo) * B[o], lr = L, lg = L * (0.7 + 0.18 * fo - rd), lb = L * (0.36 + 0.3 * fo - rd), s = 1 - 0.94 * M[i];
        let r = lr * s, g = lg * s, b = lb * s;
        if (vw > 0) {
          const k = 0.3 * (1 - A[i]), lit = I * (0.45 + 0.5 * fo) * 250;
          (r = mix(r, lr * k + C[o] * lit, vw)), (g = mix(g, lg * k + C[o + 1] * lit, vw)), (b = mix(b, lb * k + C[o + 2] * lit, vw));
        }
        (F[o] = r), (F[o + 1] = g), (F[o + 2] = b);
      } else {
        const s = I * (0.3 + 0.7 * fo) * 255 * (pt === 2 ? 1 - 0.85 * M[i] : 1);
        (F[o] = B[o] * s), (F[o + 1] = B[o + 1] * s), (F[o + 2] = B[o + 2] * s);
      }
    }
  // From the dalang's side the blencong hangs in view: a bronze garuda on a chain, the flame at its beak.
  if (vw > 0.01) {
    const bx = LX + 2, fl = P.flame / 7;
    for (let y = 0; y < 11; y++) blob(F, round(bx), y, 0.6, 0.6, y & 1 ? [90, 62, 30] : [150, 105, 50], vw);
    blob(F, bx + 6, 10.5, 2.2, 3.2, [150, 96, 36], vw), blob(F, bx, 13, 5, 2.2, [170, 112, 42], vw), blob(F, bx - 4.2, 11, 1.4, 1.6, [200, 140, 60], vw);
    blob(F, bx - 6.2, 12.8 - fl, 1.6 * fl, 6 * fl, [255, 140, 40], 0.5 * vw * I, 1), blob(F, bx - 6.2, 12.5 - fl * 0.6, 0.8, 1.9 * fl, [255, 240, 190], vw);
  }
  // The audience against the light, the rims of their heads lit by the screen.
  const HB = P.HB;
  audience(HB, P.rt);
  for (let y = AUD + 2; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y - AUD) * W + x, c = HB[k];
      if (c <= 0) continue;
      const o = (y * W + x) * 3, q = (min(y, HEM - 1) * W + x) * 3, side = min(x > 0 ? HB[k - 1] : 1, x < W - 1 ? HB[k + 1] : 1);
      const rim = (1 - (HB[k - W] + HB[k - 2 * W]) / 2) * 0.6 + (1 - side) * 0.25;
      for (let j = 0; j < 3; j++) F[o + j] = F[o + j] * (1 - c) + c * (6 + rim * RIM[j] * max(70, F[q] * 0.9));
    }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, max(0, F[o])) | 0, min(255, max(0, F[o + 1])) | 0, min(255, max(0, F[o + 2])) | 0);
}
