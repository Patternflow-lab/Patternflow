import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { HUB75_HEADER, PANEL_CENTRE, PANEL_IN, PANEL_OUT, PANEL_POWER, PLATE_SIZE, SCREW_HOLES } from "./layout";

// What the build stage makes itself rather than loading: the fasteners, the
// LED panel's back and its two leads, the power bank, the iron and the bench. Model units
// (10 mm); sizes from the BOM's parts (hardware/bom/bom_v3.9.csv) where it
// names them, otherwise ordinary ones (an M4 × 10 pan head, an EC11 nut).

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);

/** M4 × 10 pan-head screw, axis +y, tip at the origin, head at y 1.0…1.28. */
export function screwGeometry() {
  const g = new THREE.LatheGeometry(
    [v2(0, 0), v2(0.17, 0.02), v2(0.2, 0.08), v2(0.2, 1.0), v2(0.35, 1.0), v2(0.36, 1.1), v2(0.31, 1.23), v2(0.16, 1.285), v2(0, 1.29)],
    20,
  );
  g.computeVertexNormals();
  return g;
}

/**
 * The cross in the screw's head (the same frame as screwGeometry): two shallow
 * bars across the top of the dome, drawn dark. A lathed head is the same from
 * every side — without this a screw being driven does not show that it turns.
 */
export function screwRecessGeometry() {
  const bar = (turn: number) => {
    const g = new THREE.BoxGeometry(0.4, 0.03, 0.075);
    g.rotateY(turn);
    g.translate(0, 1.278, 0);
    return g;
  };
  return mergeGeometries([bar(0), bar(Math.PI / 2)]);
}

/** The encoder's washer, axis +y, sitting on y 0. */
export function washerGeometry() {
  return new THREE.LatheGeometry([v2(0.37, 0), v2(0.53, 0), v2(0.53, 0.05), v2(0.37, 0.05), v2(0.37, 0)], 28);
}

/** The encoder's hex nut (M7 bushing), axis +y, sitting on y 0, 2 mm thick. */
export function nutGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * 0.55;
    const y = Math.sin(a) * 0.55;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.355, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 24 });
  // Extruded along +z: stand it on +y.
  g.rotateX(-Math.PI / 2);
  return g;
}

// ── the LED panel's back ─────────────────────────────────────────────────────
//
// Modelled from the photos of the panel in the case, from behind (the
// finished wiring, production photo 08c-wiring-overview.jpg, for where its
// connectors are; docs/build-guide/images/v3/12_hub_in_up.jpg for the IN
// header up close): a black moulded frame whose rim is flush with the case's
// tabs, and inside it three columns of open compartments down to the driver
// board, a solid band across the middle, the two HUB75 box headers lying
// across the panel — IN in the top middle compartment, OUT in the bottom
// one — and the 4-pin power header below the band (layout.ts has the
// numbers). Everything is in the panel's own frame: its
// centre at the origin, LED face toward +z, top +y, as it sits in the case.
// The landing model's LED mesh ("l") already has the rim (18 mm wide, its
// back at z −0.85) and the recess (its floor, the driver board, at z +0.225);
// what is built here stands in that recess and never comes proud of the rim —
// the rim is what the case's ledge and tabs bear on.

/** The rim's back face and the driver board's, panel frame. */
const RIM_Z = -0.85;
const PCB_Z = 0.225;
/** The recess inside the rim: ±6.2 × ±14.25. */
const REC_X = 6.2;
const REC_Y = 14.25;
/** The ribs stop half a millimetre short of the rim's face. */
const RIB_Z = RIM_Z + 0.05;
/** The compartments: the two long ribs, the band's edge, and the cross ribs (mirrored about the band). */
const RIB_X = 2.9;
const BAND_Y = 1.15;
const CROSS_Y = [5.0, 10.9] as const;

/** One 2 × 8 box header lying across the panel, centred at (x, y), its key slot in the −y long wall. */
function boxHeader(x: number, y: number) {
  const shroud: THREE.BufferGeometry[] = [];
  const pins: THREE.BufferGeometry[] = [];
  const { w: W, h: H, d: D } = HUB75_HEADER;
  const zc = PCB_Z - D / 2;
  const wall = 0.11;
  const put = (w: number, h: number, d: number, dx: number, dy: number, z: number, into: THREE.BufferGeometry[]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x + dx, y + dy, z);
    into.push(g);
  };
  put(W, wall, D, 0, H / 2 - wall / 2, zc, shroud);
  // The keyed wall: open for 4.5 mm in the middle.
  const side = (W - 0.45) / 2;
  for (const sgn of [-1, 1]) put(side, wall, D, sgn * (0.225 + side / 2), -H / 2 + wall / 2, zc, shroud);
  for (const sgn of [-1, 1]) put(wall, H, D, sgn * (W / 2 - wall / 2), 0, zc, shroud);
  put(W, H, 0.2, 0, 0, PCB_Z - 0.1, shroud);
  for (let i = 0; i < 8; i++) for (const row of [-1, 1]) put(0.064, 0.064, 0.62, (i - 3.5) * 0.254, row * 0.127, PCB_Z - 0.2 - 0.31, pins);
  return { shroud, pins };
}

/** The driver board's face as it is seen from behind: drivers, vias, and the white lettering by the two headers. */
function panelBoardTexture(inAt: THREE.Vector2, outAt: THREE.Vector2, powerAt: THREE.Vector2) {
  const W = 512;
  const H = Math.round((W * REC_Y) / REC_X);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (!ctx) return tex;
  // Seen from behind, the panel's +x is on the left: canvas x runs toward −x, canvas y toward −y.
  const px = (x: number) => ((REC_X - x) / (2 * REC_X)) * W;
  const py = (y: number) => ((REC_Y - y) / (2 * REC_Y)) * H;
  const k = W / (2 * REC_X); // pixels per unit (10 mm)
  ctx.fillStyle = "#151a18";
  ctx.fillRect(0, 0, W, H);
  // The vias: a fine dot grid, as the board shows under its mask.
  ctx.fillStyle = "rgba(190,200,190,0.08)";
  for (let y = 3, r = 0; y < H; y += 7, r++) for (let x = 3 + (r % 2) * 3.5; x < W; x += 7) ctx.fillRect(x, y, 1.4, 1.4);
  // A fixed scatter, so the board is the same board every time.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // An SOP driver: a dark body, a row of legs along each long side.
  const chip = (x: number, y: number, w: number, h: number) => {
    const X = px(x) - (w * k) / 2;
    const Y = py(y) - (h * k) / 2;
    ctx.fillStyle = "#8f9498";
    const n = Math.max(4, Math.round(w / 0.127 / 2));
    for (let i = 0; i < n; i++) {
      const lx = X + ((i + 0.5) / n) * w * k - 1.2;
      ctx.fillRect(lx, Y - 0.16 * k, 2.4, 0.16 * k);
      ctx.fillRect(lx, Y + h * k, 2.4, 0.16 * k);
    }
    ctx.fillStyle = "#07080a";
    ctx.fillRect(X, Y, w * k, h * k);
  };
  const cols = [-(REC_X + RIB_X) / 2, 0, (REC_X + RIB_X) / 2];
  const rows = [3.0, 7.9, 12.6];
  for (const sy of [1, -1]) {
    for (const ry of rows) {
      for (const cx of cols) {
        const y = sy * ry;
        // The headers' compartments: a driver either side, the middle left to the header.
        if (cx === 0 && ry === 12.6) {
          chip(cx - 1.7, y + sy * 1.0, 0.9, 0.42);
          chip(cx + 1.7, y + sy * 1.0, 0.9, 0.42);
          continue;
        }
        // The power header's compartment (the middle one under the band) keeps its upper half clear.
        const power = cx === 0 && sy < 0 && ry === 3.0;
        const a = rnd() * 0.2;
        const b = rnd() * 0.2;
        if (!power) {
          chip(cx - 0.75 + a, y + 0.8, 1.0, 0.42);
          chip(cx + 0.75 - b, y + 0.8, 1.0, 0.42);
        }
        chip(cx - 0.6 + rnd() * 1.2, y - 0.85, 1.0, 0.42);
        ctx.fillStyle = "#b9a98a";
        for (let i = 0; i < 3; i++) ctx.fillRect(px(cx - 1.1 + rnd() * 2.2), py(y - 0.2 + rnd() * 0.5), 0.2 * k, 0.1 * k);
      }
    }
  }
  // Lettering: white silkscreen, reading up the board as the panel has it.
  ctx.fillStyle = "#d9dcd6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = (text: string, x: number, y: number, size: number, turn: number) => {
    ctx.save();
    ctx.translate(px(x), py(y));
    ctx.rotate(turn);
    ctx.font = `600 ${Math.round(size * k)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  // Seen from behind, "HUB-75E" stands left of IN (toward +x) and "IN" right of it.
  label("HUB-75E", inAt.x + HUB75_HEADER.w / 2 + 0.42, inAt.y, 0.42, -Math.PI / 2);
  label("IN", inAt.x - HUB75_HEADER.w / 2 - 0.42, inAt.y, 0.46, -Math.PI / 2);
  label("OUT", outAt.x - HUB75_HEADER.w / 2 - 0.42, outAt.y, 0.42, -Math.PI / 2);
  // Under the power header, upside down from here, as the board prints it.
  label("VCC GND", powerAt.x, powerAt.y - 0.86, 0.3, Math.PI);
  // The two arrows the panel prints at its OUT end, as photo 08c has them:
  // seen from behind with IN at the top, one pointing DOWN in the bottom-left
  // compartment and one pointing RIGHT in the bottom-right one. They mark the
  // data's way through the panel (IN → OUT), not "this way up" — there is no
  // arrow at the IN end, and none points up. `turn` is clockwise on the
  // canvas, from pointing up.
  const arrow = (x: number, y: number, turn: number) => {
    const s = 0.3 * k;
    ctx.save();
    ctx.translate(px(x), py(y));
    ctx.rotate(turn);
    ctx.fillStyle = "#b9bcb6";
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.75, -s * 0.1);
    ctx.lineTo(s * 0.32, -s * 0.1);
    ctx.lineTo(s * 0.32, s);
    ctx.lineTo(-s * 0.32, s);
    ctx.lineTo(-s * 0.32, -s * 0.1);
    ctx.lineTo(-s * 0.75, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  // Canvas left is the panel's +x (the bay's side).
  arrow(cols[2] - 0.9, -12.25, Math.PI);
  arrow(cols[0] + 0.75, -11.85, Math.PI / 2);
  tex.needsUpdate = true;
  return tex;
}

/**
 * The back of the LED panel, in the panel's frame, by material: the moulded
 * frame (ribs, band, posts), the driver board (a plane and its texture), the
 * header shrouds, the pins, the power header, the board's electrolytic cans,
 * and the brass inserts in the rim under the case's twelve screw slots.
 */
export function panelBack() {
  const c = PANEL_CENTRE;
  const at = (p: THREE.Vector3) => new THREE.Vector2(p.x - c.x, p.y - c.y);
  const inAt = at(PANEL_IN);
  const outAt = at(PANEL_OUT);
  const powerAt = at(PANEL_POWER);
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, into = parts) => {
    const b = new THREE.BoxGeometry(w, h, d);
    b.translate(x, y, z);
    into.push(b);
  };
  const ribD = PCB_Z - RIB_Z;
  const ribZ = (PCB_Z + RIB_Z) / 2;
  // Two long ribs (each a double wall, as moulded) and the cross ribs.
  for (const x of [-RIB_X, RIB_X]) for (const dx of [-0.17, 0.17]) box(0.12, 2 * REC_Y, ribD, x + dx, 0, ribZ);
  for (const sy of [-1, 1]) for (const y of CROSS_Y) for (const dy of [-0.2, 0.2]) box(2 * REC_X, 0.12, ribD, 0, sy * (y + dy), ribZ);
  // The band across the middle: a solid plate a little below the rim, its edges
  // ribbed, three diamonds standing on it.
  const bandZ = RIM_Z + 0.22;
  box(2 * REC_X, 2 * BAND_Y, PCB_Z - bandZ, 0, 0, (PCB_Z + bandZ) / 2);
  for (const sy of [-1, 1]) box(2 * REC_X, 0.12, ribD, 0, sy * BAND_Y, ribZ);
  for (const x of [-(REC_X + RIB_X) / 2, 0, (REC_X + RIB_X) / 2]) {
    const d = new THREE.CylinderGeometry(1.0, 1.0, 0.17, 4);
    d.rotateX(Math.PI / 2);
    d.scale(1.25, 0.82, 1);
    d.translate(x, 0, bandZ - 0.085);
    parts.push(d);
  }
  // The moulded posts where the ribs cross, and in the band.
  const post = (x: number, y: number, r = 0.42) => {
    const p = new THREE.CylinderGeometry(r, r, ribD, 18);
    p.rotateX(Math.PI / 2);
    p.translate(x, y, ribZ);
    parts.push(p);
  };
  for (const sy of [-1, 1]) {
    for (const x of [-RIB_X, RIB_X]) post(x, sy * 7.6);
    post(0, sy * CROSS_Y[0]);
    post(0, sy * CROSS_Y[1]);
  }
  const frame = mergeGeometries(parts.splice(0));

  // The driver board: one plane on the recess's floor, facing the back.
  const board = new THREE.PlaneGeometry(2 * REC_X, 2 * REC_Y);
  board.rotateY(Math.PI);
  board.translate(0, 0, PCB_Z - 0.004);

  const shroud: THREE.BufferGeometry[] = [];
  const pins: THREE.BufferGeometry[] = [];
  for (const p of [inAt, outAt]) {
    const h = boxHeader(p.x, p.y);
    shroud.push(...h.shroud);
    pins.push(...h.pins);
  }
  // The power header (VH, 3.96 mm pitch): a base, the latch wall along its lower side, four square pins.
  box(1.6, 0.86, 0.3, powerAt.x, powerAt.y, PCB_Z - 0.15);
  box(1.6, 0.12, 0.95, powerAt.x, powerAt.y - 0.37, PCB_Z - 0.475);
  const power = mergeGeometries(parts.splice(0));
  for (let i = 0; i < 4; i++) box(0.11, 0.11, 0.85, powerAt.x + (i - 1.5) * 0.396, powerAt.y + 0.05, PCB_Z - 0.3 - 0.425, pins);

  // Electrolytic cans, one or two a compartment.
  const cans: THREE.BufferGeometry[] = [];
  const side = (REC_X + RIB_X) / 2;
  const canAt: [number, number][] = [
    [side - 0.2, 13.4],
    [-side - 0.1, 13.5],
    [0.3, 8.9],
    [side + 0.6, 6.4],
    [-side - 0.5, 6.6],
    [1.9, 2.3],
    [side - 0.7, 2.4],
    [-side + 0.6, 2.9],
    [1.6, -3.7],
    [side + 0.3, -3.0],
    [-side - 0.4, -2.5],
    [side - 0.6, -8.0],
    [0.4, -7.6],
    [-side + 0.5, -9.2],
    [side - 0.4, -13.4],
    [-side + 0.3, -13.3],
  ];
  for (const [x, y] of canAt) {
    const g = new THREE.CylinderGeometry(0.315, 0.315, 0.55, 18);
    g.rotateX(Math.PI / 2);
    g.translate(x, y, PCB_Z - 0.275);
    cans.push(g);
  }

  // Brass inserts in the rim, their faces flush with it, one under each screw slot.
  const inserts: THREE.BufferGeometry[] = [];
  for (const [hx, hy] of SCREW_HOLES) {
    const ring = new THREE.RingGeometry(0.19, 0.31, 20);
    ring.rotateY(Math.PI);
    ring.translate(hx - c.x, hy - c.y, RIM_Z - 0.004);
    inserts.push(ring);
  }
  return {
    frame,
    board,
    boardTexture: panelBoardTexture(inAt, outAt, powerAt),
    shroud: mergeGeometries(shroud),
    pins: mergeGeometries(pins),
    power,
    cans: mergeGeometries(cans),
    inserts: mergeGeometries(inserts),
  };
}

// ── the panel's two leads ────────────────────────────────────────────────────

/** A 2 × 8 IDC socket with its strain relief, in its own frame: mating face at z 0, its back at z −`d`; the ribbon leaves at z −(d − 0.12). */
export const IDC_PLUG = { w: 2.54, h: 0.62, d: 0.95, into: 0.35 } as const;

export function idcPlug(along: "x" | "y") {
  const { w, h, d } = IDC_PLUG;
  const body = new THREE.BoxGeometry(along === "x" ? w : h, along === "x" ? h : w, d - 0.3);
  body.translate(0, 0, -(d - 0.3) / 2);
  // The strain relief: a wider cap clamped over the ribbon.
  const cap = new THREE.BoxGeometry(along === "x" ? w + 0.1 : h + 0.08, along === "x" ? h + 0.08 : w + 0.1, 0.3);
  cap.translate(0, 0, -(d - 0.15));
  return mergeGeometries([body, cap]);
}

/**
 * The HUB75 ribbon as it is fitted (the photos: 14_wiring.jpg, 08c): flat
 * from J1's plug across to under the panel's IN, folded once at 45°, and up
 * to IN's plug. In the model frame, where it sits in the case: the flat run
 * at z `z0` from x `x0` (J1's plug) to the fold under `inX`, centred on y
 * `y0`; the upright run from the fold to y `y1`, rising to z `z1` at IN's
 * plug. 16 wires at 1.27 mm: 20.3 mm wide; wire 1's red stripe is the flat
 * run's top edge, which the fold turns to the upright run's −x edge.
 *
 * It is a cable, and is handled like one: each run is cut into strips along
 * its length, and `bend` moves them — how far out of its seat each end and
 * the fold between them are held (toward −z, model units), and how far the
 * runs hang from the fold under their own weight (`sag`, in the ribbon's own
 * frame). bend(0, 0, 0) is the ribbon as fitted. The ends carry the plugs:
 * `ends` is where each one is, as an offset from its fitted place.
 */
export function foldedRibbon(x0: number, y0: number, z0: number, inX: number, y1: number, z1: number) {
  const w = 2.03;
  const t = 0.09;
  const hw = w / 2;
  const s = 0.13; // the stripe's width
  const FLAT = 14; // strips along the flat run
  const UP = 8; // and along the upright one
  type Strip = { pos: number[]; w1: number[]; w2: number[] };
  const soft = (x: number) => x * x * (3 - 2 * x);
  /** A run between two edges (each a start and an end point), in `n` strips, `t` thick toward +z; `weight` says which end's it is. */
  const run = (a0: number[], a1: number[], b0: number[], b1: number[], n: number, which: 1 | 2, into: Strip) => {
    const at = (p0: number[], p1: number[], f: number, dz: number) => [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f + dz];
    const quad = (p: number[][], f: number[]) => {
      // Two triangles, the weight of each corner beside it.
      for (const k of [0, 1, 2, 0, 2, 3]) {
        into.pos.push(...p[k]);
        // Flat run: 1 at J1's end (f 0), 0 at the fold. Upright: 0 at the fold (f 0), 1 at IN's end.
        const wt = which === 1 ? 1 - soft(f[k]) : soft(f[k]);
        into.w1.push(which === 1 ? wt : 0);
        into.w2.push(which === 2 ? wt : 0);
      }
    };
    for (let i = 0; i < n; i++) {
      const f0 = i / n;
      const f1 = (i + 1) / n;
      // back (toward −z), front, and the two long edges
      quad([at(a0, a1, f0, 0), at(b0, b1, f0, 0), at(b0, b1, f1, 0), at(a0, a1, f1, 0)], [f0, f0, f1, f1]);
      quad([at(a0, a1, f0, t), at(a0, a1, f1, t), at(b0, b1, f1, t), at(b0, b1, f0, t)], [f0, f1, f1, f0]);
      quad([at(a0, a1, f0, 0), at(a0, a1, f1, 0), at(a0, a1, f1, t), at(a0, a1, f0, t)], [f0, f1, f1, f0]);
      quad([at(b0, b1, f0, 0), at(b0, b1, f0, t), at(b0, b1, f1, t), at(b0, b1, f1, 0)], [f0, f0, f1, f1]);
    }
  };
  const grey: Strip = { pos: [], w1: [], w2: [] };
  const red: Strip = { pos: [], w1: [], w2: [] };
  // The flat run: from J1's plug to the fold line (inX + hw, y0 − hw) → (inX − hw, y0 + hw).
  run([x0, y0 - hw, z0], [inX + hw, y0 - hw, z0], [x0, y0 + hw - s, z0], [inX - hw + s, y0 + hw - s, z0], FLAT, 1, grey);
  run([x0, y0 + hw - s, z0], [inX - hw + s, y0 + hw - s, z0], [x0, y0 + hw, z0], [inX - hw, y0 + hw, z0], FLAT, 1, red);
  // The upright run, lying on the flat one at the fold (behind it: toward −z).
  const zf = z0 - t;
  run([inX - hw + s, y0 + hw - s, zf], [inX - hw + s, y1, z1], [inX + hw, y0 - hw, zf], [inX + hw, y1, z1], UP, 2, grey);
  run([inX - hw, y0 + hw, zf], [inX - hw, y1, z1], [inX - hw + s, y0 + hw - s, zf], [inX - hw + s, y1, z1], UP, 2, red);
  const make = (d: Strip) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(d.pos), 3).setUsage(THREE.DynamicDrawUsage));
    g.computeVertexNormals();
    return { geometry: g, rest: new Float32Array(d.pos), w1: new Float32Array(d.w1), w2: new Float32Array(d.w2) };
  };
  const parts = [make(grey), make(red)];
  const ends = [new THREE.Vector3(), new THREE.Vector3()];
  let bent = false;
  /** How far the upright run hangs for a given hang of the flat one: it is a third as long. */
  const SHORT = 0.3;
  const bend = (e1: number, fold: number, e2: number, sag?: THREE.Vector3) => {
    const sx = sag?.x ?? 0;
    const sy = sag?.y ?? 0;
    const sz = sag?.z ?? 0;
    const still = e1 === 0 && fold === 0 && e2 === 0 && sx === 0 && sy === 0 && sz === 0;
    ends[0].set(sx, sy, sz - e1);
    ends[1].set(sx * SHORT, sy * SHORT, sz * SHORT - e2);
    if (still && !bent) return;
    bent = !still;
    for (const p of parts) {
      const pos = p.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0, k = 0; k < p.w1.length; i += 3, k++) {
        const a = p.w1[k];
        const b = p.w2[k];
        const hang = a + b * SHORT;
        arr[i] = p.rest[i] + sx * hang;
        arr[i + 1] = p.rest[i + 1] + sy * hang;
        arr[i + 2] = p.rest[i + 2] + sz * hang - (fold + (e1 - fold) * a + (e2 - fold) * b);
      }
      pos.needsUpdate = true;
      p.geometry.computeVertexNormals();
    }
  };
  return { cable: parts[0].geometry, stripe: parts[1].geometry, bend, ends };
}

/** The panel's power lead's plug (VH, 4-way housing), in its own frame: mating face at z 0, the wires leaving its back at z −0.9. */
export function vhPlug() {
  const g = new THREE.BoxGeometry(1.62, 0.62, 0.9);
  g.translate(0, 0, -0.45);
  return g;
}

/** A 10 000 mAh-class USB power bank, standing (long side along y), its USB-A port in the top end. */
export function powerBank() {
  const body = new RoundedBoxGeometry(6.6, 14.4, 1.5, 3, 0.45);
  const port = new THREE.BoxGeometry(1.25, 0.08, 0.5);
  port.translate(0, 7.2, 0);
  const led = new THREE.BoxGeometry(0.5, 0.06, 0.12);
  led.translate(1.8, 7.2, 0.35);
  return { body, port, led };
}

/** The sacrificial cable's USB-A plug, its mouth at the origin pointing −y. */
export function usbPlug() {
  const shell = new THREE.BoxGeometry(1.2, 1.2, 0.45);
  shell.translate(0, -0.6, 0);
  const boot = new RoundedBoxGeometry(1.45, 1.6, 0.75, 2, 0.18);
  boot.translate(0, 0.75, 0);
  return { shell, boot };
}

/**
 * A soldering iron: tip at the origin, the iron running up +y. Three turned
 * parts, each a lathe profile (radius, height): the plated tip, a cone a
 * hair blunt on its shank; the heater's steel barrel, with the collar that
 * holds the tip and the nut that holds the barrel; and the handle — a guard
 * ahead of the fingers, a waist for them, a rounded end.
 */
export function iron() {
  const lathe = (profile: [number, number][], segments: number) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  const tip = lathe([[0, 0], [0.026, 0.014], [0.082, 0.62], [0.082, 0.96]], 20);
  const barrel = lathe([[0.082, 0.96], [0.15, 0.96], [0.15, 1.14], [0.112, 1.16], [0.112, 2.96], [0.2, 2.98], [0.2, 3.32], [0.12, 3.34]], 24);
  const grip = lathe([[0.12, 3.34], [0.3, 3.34], [0.37, 3.46], [0.37, 3.62], [0.27, 3.9], [0.245, 5.2], [0.3, 6.5], [0.3, 7.7], [0.24, 7.96], [0, 8.02]], 28);
  return { tip, barrel, grip };
}

/** The PCB holder: two posts with jaws, gripping the board's short edges. */
export function holder() {
  const post = new THREE.CylinderGeometry(0.22, 0.3, 1, 14);
  post.translate(0, 0.5, 0); // scaled to height by the stage
  const jaw = new THREE.BoxGeometry(1.6, 0.55, 0.5);
  const base = new THREE.CylinderGeometry(0.9, 1.0, 0.18, 20);
  base.translate(0, 0.09, 0);
  return { post, jaw, base };
}

/** The bench mat: a rounded slab. */
export function mat(w: number, d: number) {
  const g = new RoundedBoxGeometry(w, 0.03, d, 2, 0.012);
  g.translate(0, 0.015, 0);
  return g;
}

/** A print plate (textured PEI over steel): its corner at the origin, its top a hair under y 0, where the parts' first layer lies. */
export function plate() {
  const g = new RoundedBoxGeometry(PLATE_SIZE, 0.12, PLATE_SIZE, 2, 0.05);
  g.translate(PLATE_SIZE / 2, -0.066, -PLATE_SIZE / 2);
  return g;
}

/**
 * The shade a print plate keeps round its foot, as an alpha map for a square
 * of ground `margin` wider than the plate all round: close and dark under
 * the plate's edge, gone a few centimetres out.
 */
export function plateShade(margin: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 128, 128);
    const px = 128 / (PLATE_SIZE + margin * 2);
    // Twice: a wide soft one, and a tight one where the plate meets the mat.
    for (const [blur, a] of [
      [margin * px * 0.8, 0.5],
      [margin * px * 0.28, 0.8],
    ]) {
      ctx.shadowColor = `rgba(255,255,255,${a})`;
      ctx.shadowBlur = blur;
      ctx.fillStyle = "#fff";
      ctx.fillRect(margin * px, margin * px, PLATE_SIZE * px, PLATE_SIZE * px);
    }
  }
  return new THREE.CanvasTexture(c);
}

/**
 * The outline of a part as it lies on its print plate, seen from above: the
 * outermost point of it in each of `n` directions (plate x, z), drawn in a
 * little — where the nozzle lays the part's outer wall, near enough.
 */
export function footprint(g: THREE.BufferGeometry, n = 28, inset = 0.06): [number, number][] {
  const pos = g.getAttribute("position");
  const far = new Float32Array(n).fill(-Infinity);
  const out: [number, number][] = Array.from({ length: n }, () => [0, 0]);
  const cos = Array.from({ length: n }, (_, k) => Math.cos((k / n) * Math.PI * 2));
  const sin = Array.from({ length: n }, (_, k) => Math.sin((k / n) * Math.PI * 2));
  let cx = 0;
  let cz = 0;
  // Every third vertex is plenty for an outline.
  const step = pos.count > 3000 ? 3 : 1;
  let count = 0;
  for (let i = 0; i < pos.count; i += step) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    cx += x;
    cz += z;
    count++;
    for (let k = 0; k < n; k++) {
      const d = x * cos[k] + z * sin[k];
      if (d > far[k]) {
        far[k] = d;
        out[k][0] = x;
        out[k][1] = z;
      }
    }
  }
  cx /= Math.max(1, count);
  cz /= Math.max(1, count);
  for (const p of out) {
    const dx = cx - p[0];
    const dz = cz - p[1];
    const l = Math.hypot(dx, dz) || 1;
    p[0] += (dx / l) * inset;
    p[1] += (dz / l) * inset;
  }
  return out;
}

/** A coil of cable lying on the mat (a few loose turns). */
export function coil(radius: number, tube: number, turns: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < turns; i++) {
    const t = new THREE.TorusGeometry(radius * (1 - i * 0.07), tube, 8, 40);
    t.rotateX(Math.PI / 2);
    t.translate(i * 0.12, tube + i * tube * 1.6, i * 0.08);
    parts.push(t);
  }
  return mergeGeometries(parts);
}

/** A tape strip across a seam. */
export function tapeStrip(length: number) {
  return new THREE.BoxGeometry(0.9, length, 0.02);
}

/** A soft round glow for sprites (a print's nozzle). */
export function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,226,180,0.85)");
    g.addColorStop(1, "rgba(255,160,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
