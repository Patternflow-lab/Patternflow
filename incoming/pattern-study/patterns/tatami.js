// ===== Patternflow pattern =====
// Title:   Tatami
// Family:  geometry
// Idea:    Rectangular mats of one size are laid so that no four corners ever meet at a point, which is the herringbone with two mats to a step, and the Shape knob stretches the mat from a short block to a long plank while the Turn knob swings the whole floor.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the tatami rule of floor laying in Japan, that no four mats meet at a corner, and its herringbone (Frank Ruskey and Jennifer Woodcock, 2009, on counting the tilings that obey it), original, pattern round 136
// Round:   136
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Mat=0..3, Shape=-1..1, Turn=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The upright mats and the lying ones are a few steps apart on it.
// Knob 2: Mat. How wide a mat is, from 2.5 LEDs to 10; the knob's 2 is 7.5. The length keeps its ratio to the width, so the floor keeps its shape and only the number of mats changes.
// Knob 3: Shape. How long a mat is against its width, from one and a half widths at the left through three and a third in the middle to five at the right. The short mats make squat steps and the long ones make a stair that climbs a long way before it turns. A square mat is left out, because squares stack in a grid and four corners meet.
// Knob 4: Turn. The angle of the whole floor, from flat at the left through 45 degrees in the middle to a quarter turn at the right. At 45 degrees the steps stand as chevrons; at the ends the steps climb the panel as stairs.

const W = 64;
const H = 128;
const JOINT = 1;

function hsv(h, s, v, out, at) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[at] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[at + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[at + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.w = 7.5;
  params.l = 22.5;
  params.cos = 1;
  params.sin = 0;
  params.ox = 0;
  params.oy = 0;
  params.lying = new Float32Array(3);
  params.upright = new Float32Array(3);
  params.joint = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath widens the mats a little, stretches them and turns the floor a degree or so, and the floor creeps along its steps.
  const w = (2.5 + 2.5 * k[1]) * (1 + 0.02 * Math.sin(t * 0.41));
  const r = (3.25 + 1.75 * k[2]) * (1 + 0.015 * Math.sin(t * 0.33 + 1));
  params.w = w;
  params.l = w * r;
  const th = ((45 + 45 * k[3]) * Math.PI) / 180 + 0.02 * Math.sin(t * 0.27 + 3);
  params.cos = Math.cos(th);
  params.sin = Math.sin(th);
  params.ox = w * 0.35 + w * 0.05 * Math.sin(t * 0.23);
  params.oy = w * 0.2 + w * 0.05 * Math.sin(t * 0.19 + 2);
  hsv(k[0] + 0.55, 0.75, 0.95, params.lying, 0);
  hsv(k[0] + 0.68, 0.8, 0.55, params.upright, 0);
  hsv(k[0] + 0.6, 0.6, 0.05, params.joint, 0);
}

export function draw(display, params, time) {
  const w = params.w;
  const l = params.l;
  const co = params.cos;
  const si = params.sin;
  const ox = params.ox;
  const oy = params.oy;
  const lying = params.lying;
  const upright = params.upright;
  const joint = params.joint;
  const half = (JOINT + 1) / 2;
  // The floor repeats by two steps. A is one step along the stair of a chain of mats and B is the shift to the next chain.
  const ax = l + w;
  const ay = w - l;
  const det = 2 * l * w;
  for (let y = 0; y < H; y++) {
    const zy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const zx = x + 0.5 - W / 2;
      const px = zx * co + zy * si + ox;
      const py = -zx * si + zy * co + oy;
      // The fractions of A and of B that reach this point, then every nearby pair of whole steps is tried.
      const al = (px - py) / (2 * l);
      const be = (ax * py - ay * px) / det;
      const i0 = Math.floor(al);
      const j0 = Math.floor(be);
      let edge = -1;
      let up = false;
      for (let i = i0 - 1; i <= i0 + 1 && edge < 0; i++) {
        for (let j = j0 - 3; j <= j0 + 1; j++) {
          const qx = px - i * ax - j * w;
          const qy = py - i * ay - j * w;
          // The lying mat, then the upright one beside its right end.
          if (qx >= 0 && qx < l && qy >= 0 && qy < w) {
            const e = Math.min(qx, l - qx, qy, w - qy);
            edge = e;
            up = false;
            break;
          }
          if (qx >= l && qx < l + w && qy >= w - l && qy < w) {
            const e = Math.min(qx - l, l + w - qx, qy - (w - l), w - qy);
            edge = e;
            up = true;
            break;
          }
        }
      }
      const c = up ? upright : lying;
      if (edge < 0) {
        display.setPixel(x, y, joint[0], joint[1], joint[2]);
        continue;
      }
      let a = half - edge;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      display.setPixel(
        x,
        y,
        c[0] + (joint[0] - c[0]) * a,
        c[1] + (joint[1] - c[1]) * a,
        c[2] + (joint[2] - c[2]) * a
      );
    }
  }
}
