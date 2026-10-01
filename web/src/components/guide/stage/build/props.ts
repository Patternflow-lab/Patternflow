import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PANEL_CENTRE, PANEL_IN, PANEL_OUT, PANEL_POWER, PLATE_SIZE, SCREW_HOLES } from "./layout";

// What the build stage makes itself rather than loading: the fasteners, the
// LED panel's back, the power bank, the tools and the bench. Model units
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

/**
 * The back of the LED panel, in its own frame (the panel's centre at the
 * origin, LED face toward +z, top +y, as it sits in the case): a moulded
 * frame of ribs, a threaded boss under each of the case's twelve screw
 * slots, the HUB75 IN and OUT headers and the 4-pin power connector.
 */
export function panelBack() {
  const c = PANEL_CENTRE;
  const back = -0.85; // the panel's back face, relative to its centre
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const b = new THREE.BoxGeometry(w, h, d);
    b.translate(x, y, z);
    parts.push(b);
  };
  // Ribs: a grid moulded into the back, 2 mm proud.
  for (const x of [-7.6, -2.6, 2.6, 7.6]) box(0.22, 31.2, 0.2, x, 0, back - 0.1);
  for (const y of [-15.4, -10.3, -5.1, 0, 5.1, 10.3, 15.4]) box(15.4, 0.22, 0.2, 0, y, back - 0.1);
  const ribs = mergeGeometries(parts.splice(0));
  for (const [hx, hy] of SCREW_HOLES) {
    const b = new THREE.CylinderGeometry(0.34, 0.38, 0.22, 16);
    b.rotateX(Math.PI / 2);
    b.translate(hx - c.x, hy - c.y, back - 0.11);
    parts.push(b);
    const hole = new THREE.CylinderGeometry(0.17, 0.17, 0.23, 12);
    hole.rotateX(Math.PI / 2);
    hole.translate(hx - c.x, hy - c.y, back - 0.115);
    parts.push(hole);
  }
  const bosses = mergeGeometries(parts.splice(0));
  // Shrouded 2 × 8 headers, upright (2.0 × 0.9), 6 mm proud.
  for (const p of [PANEL_IN, PANEL_OUT]) box(0.95, 2.1, 0.6, p.x - c.x, p.y - c.y, back - 0.3);
  const headers = mergeGeometries(parts.splice(0));
  box(1.25, 0.55, 0.55, PANEL_POWER.x - c.x, PANEL_POWER.y - c.y, back - 0.27);
  const power = mergeGeometries(parts.splice(0));
  return { ribs, bosses, headers, power };
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

/** A soldering iron: tip at the origin, the iron running up +y. */
export function iron() {
  const tip = new THREE.CylinderGeometry(0.03, 0.12, 0.9, 12);
  tip.translate(0, 0.45, 0);
  const barrel = new THREE.CylinderGeometry(0.2, 0.2, 2.6, 16);
  barrel.translate(0, 0.9 + 1.3, 0);
  const grip = new THREE.CylinderGeometry(0.42, 0.36, 4.6, 20);
  grip.translate(0, 3.5 + 2.3, 0);
  return { metal: mergeGeometries([tip, barrel]), grip };
}

/** A multimeter probe: needle tip at the origin, the probe running up +y. */
export function probe() {
  const needle = new THREE.CylinderGeometry(0.02, 0.035, 1.1, 8);
  needle.translate(0, 0.55, 0);
  const body = new THREE.CylinderGeometry(0.17, 0.2, 4.2, 14);
  body.translate(0, 1.1 + 2.1, 0);
  const guard = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14);
  guard.translate(0, 1.25, 0);
  return { needle, body: mergeGeometries([body, guard]) };
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

/** A print plate (textured PEI over steel): its corner at the origin, top at y 0. */
export function plate() {
  const g = new RoundedBoxGeometry(PLATE_SIZE, 0.12, PLATE_SIZE, 2, 0.05);
  g.translate(PLATE_SIZE / 2, -0.06, -PLATE_SIZE / 2);
  return g;
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

/** The folded HUB75 ribbon lying on the mat: a flat zig-zag, its two IDC plugs on top. */
export function ribbonCoil() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.BoxGeometry(2.03, 0.05, 5.2);
    r.translate(i * 0.08, 0.03 + i * 0.06, i * 0.1);
    parts.push(r);
  }
  return mergeGeometries(parts);
}

/** A tape strip across a seam. */
export function tapeStrip(length: number) {
  return new THREE.BoxGeometry(0.9, length, 0.02);
}

/** A soft round glow for sprites (a solder joint's glint). */
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
