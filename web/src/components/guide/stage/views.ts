import * as THREE from "three";
import type { ViewName } from "../scenes";
import { KNOB_CLUSTER_WORLD, LED_CENTER_WORLD, MODEL_OFFSET, MODEL_SCALE } from "./geometry";
import { DEVKIT_PRESENT, M_TO_MODEL } from "./parts";

// Where the camera stands for each step, in world units (the device is about
// 2.5 wide, 3.2 tall and 0.55 deep, centred on the origin, facing +z).
//
// A view is a target, the direction the camera looks at it from, and a frame:
// the points that must be on screen, inside the part of it the copy leaves
// free (left of the card on a wide screen, above it on a narrow one). The
// camera rig (GuideCanvas) backs off along the direction until the frame
// fits that area at the screen's own aspect — the fov is vertical, so on a
// phone in portrait it is the width that decides — and never comes closer
// than `minR`. On a desktop the device views sit at their authored distance
// (their frame fits well inside it); the DevKit views are sized by their
// frame everywhere.

export type View = {
  target: THREE.Vector3;
  /** Unit vector from the target toward the camera. */
  dir: THREE.Vector3;
  /** The closest the camera comes to the target. */
  minR: number;
  /** World points that must be inside the free area. */
  frame: THREE.Vector3[];
  /** Share of the free area (each way) the frame may take. */
  fill: number;
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const kc = KNOB_CLUSTER_WORLD;
const led = LED_CENTER_WORLD;

function corners(min: THREE.Vector3, max: THREE.Vector3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push(v(x, y, z));
  return out;
}

/** A point on the DevKit (its canonical frame, metres) where it is held up, in world units. */
export function kitToWorld(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out
    .copy(p)
    .applyQuaternion(DEVKIT_PRESENT.quaternion)
    .multiplyScalar(M_TO_MODEL)
    .add(DEVKIT_PRESENT.position)
    .multiplyScalar(MODEL_SCALE)
    .add(MODEL_OFFSET);
}

/** A box on the DevKit, in its own frame, as world points. */
function kitBox(min: [number, number, number], max: [number, number, number]) {
  return corners(v(...min), v(...max)).map((p) => kitToWorld(p));
}

/** The DevKit's face normal where it is held up, turned `yaw` (to the reader's right) and `pitch` (from above), degrees. */
function kitDir(yaw: number, pitch: number) {
  const n = v(0, 0, 1).applyQuaternion(DEVKIT_PRESENT.quaternion);
  const d = n.applyAxisAngle(v(1, 0, 0), THREE.MathUtils.degToRad(-pitch));
  return d.applyAxisAngle(v(0, 1, 0), THREE.MathUtils.degToRad(yaw)).normalize();
}

function fromPos(pos: THREE.Vector3, target: THREE.Vector3, frame: THREE.Vector3[], fill = 0.9): View {
  const d = pos.clone().sub(target);
  return { target, dir: d.clone().normalize(), minR: d.length(), frame, fill };
}

function kitView(targetLocal: [number, number, number], yaw: number, pitch: number, frame: THREE.Vector3[], fill: number): View {
  return { target: kitToWorld(v(...targetLocal)), dir: kitDir(yaw, pitch), minR: 0.5, frame, fill };
}

// The whole device (case, knobs, panel).
const DEVICE = corners(v(-1.23, -1.63, -0.2), v(1.23, 1.58, 0.37));

export const VIEWS: Record<ViewName, View> = {
  hero: fromPos(v(4.2, 1.9, 11.6), v(0.1, 0.05, 0), DEVICE, 0.92),
  front: fromPos(v(0.6, 0.3, 11.8), v(0.2, 0, 0), DEVICE, 0.92),
  // With the device's Wi-Fi rising off its top edge (Fx).
  wide: fromPos(v(-0.8, 0.9, 15), v(0, 0.25, 0), corners(v(-1.23, -1.63, -0.2), v(1.23, 2.45, 0.37)), 0.94),
  // The pocket on the back, close, from behind and off to the knob column's
  // side, a little above: the DevKit on its sockets fills the middle of the
  // frame and its 26 mm lift straight off its pins shows side-on, as a gap
  // opening between it and the board. The case is allowed to crop; the back
  // cover slides out of the frame toward the camera's side and is set down
  // out of shot. The same view watches it all go back ("Back in", GuideCanvas).
  back: {
    target: v(0.74, 0.86, -0.24),
    dir: v(1.15, 0.42, -1).normalize(),
    minR: 1.4,
    frame: corners(v(0.12, 0.16, -0.5), v(1.28, 1.6, 0.0)),
    fill: 0.94,
  },
  // The whole panel, square on: the SELECT screen's "1 / 1" at its top and
  // "HOLD TO SELECT" at its bottom are what the step is about (the panel is
  // 1.6 × 3.2, Fx.tsx). The knob column's outer edge is in the frame too, so
  // a phone, where the width decides, doesn't cut the knobs in half.
  screen: fromPos(
    v(led.x + 0.2, led.y + 0.1, 5.4),
    v(led.x, led.y, 0.1),
    [...corners(v(led.x - 0.8, led.y - 1.6, 0.15), v(led.x + 0.8, led.y + 1.6, 0.15)), v(kc.x + 0.45, kc.y, 0.37)],
    0.94,
  ),
  screenKnobs: fromPos(v(1.8, 0.9, 8.6), v(0.25, 0.15, 0.1), DEVICE, 0.94),
  // Close on the knobs but with the top of the panel in frame, from a little
  // below and to the right so the case is a lit edge rather than a white wall.
  knobs: fromPos(
    v(kc.x + 1.5, kc.y - 0.9, 4.6),
    v(kc.x - 0.35, kc.y - 0.25, kc.z),
    corners(v(kc.x - 0.75, kc.y - 0.45, 0.15), v(kc.x + 0.55, kc.y + 0.35, 0.37)),
    0.94,
  ),
  // The DevKit held up right of the device (parts.ts DEVKIT_PRESENT), seen
  // nearly square to its face, a little from the right and level: from the
  // left the device's own side comes into the shot, and from higher up the
  // back cover lying on the floor behind (parts.ts) does. One framing for
  // holding it, flashing and Wi-Fi — the whole board, the arcs over the
  // antenna and the RST tag — so those steps don't move the camera.
  esp: kitView([0.004, 0.006, 0], 17, 0, kitBox([-0.022, -0.036, -0.009], [0.034, 0.05, 0.004]), 0.8),
  // The ports, low in the frame with the whole board above them: both ports,
  // their tags either side and the plug going in — from a touch below, so the
  // port mouths show.
  espPorts: kitView([0, -0.014, 0], 17, -5, kitBox([-0.038, -0.064, -0.006], [0.038, 0.037, 0.004]), 0.97),
  // BOOT and RST, with the module above and the ports below for bearings.
  espButtons: kitView([0.008, -0.003, 0], 17, 1, kitBox([-0.018, -0.032, -0.004], [0.036, 0.026, 0.004]), 0.72),
};
