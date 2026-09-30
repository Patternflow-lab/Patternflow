import * as THREE from "three";
import type { ViewName } from "../scenes";
import { KNOB_CLUSTER_WORLD, LED_CENTER_WORLD } from "./geometry";

// Camera positions, in world units (the model is ~2.5 wide and 3.3 tall,
// centred on the origin, facing +z).

type View = { pos: THREE.Vector3; target: THREE.Vector3 };

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const kc = KNOB_CLUSTER_WORLD;
const led = LED_CENTER_WORLD;

export const VIEWS: Record<ViewName, View> = {
  hero: { pos: v(4.2, 1.9, 11.6), target: v(0.1, 0.05, 0) },
  front: { pos: v(0.6, 0.3, 11.8), target: v(0.2, 0, 0) },
  wide: { pos: v(-0.8, 0.9, 15), target: v(0, 0, 0) },
  back: { pos: v(-3.6, 1.6, -9.6), target: v(0.4, 0.2, 0) },
  screen: { pos: v(led.x + 0.2, led.y + 0.1, 5.4), target: v(led.x, led.y, 0.1) },
  screenKnobs: { pos: v(1.8, 0.9, 8.6), target: v(0.25, 0.15, 0.1) },
  // Close on the knobs but with the top of the panel in frame, from a little
  // below and to the right so the case is a lit edge rather than a white wall.
  knobs: { pos: v(kc.x + 1.5, kc.y - 0.9, 4.6), target: v(kc.x - 0.35, kc.y - 0.25, kc.z) },
  // The DevKit held up at world (2.6, -0.15, 2.4), about 0.63 tall.
  esp: { pos: v(3.25, 0.12, 4.75), target: v(2.62, -0.08, 2.4) },
  espPorts: { pos: v(2.95, -0.4, 4.3), target: v(2.62, -0.3, 2.4) },
  espButtons: { pos: v(2.82, -0.02, 3.9), target: v(2.6, -0.12, 2.4) },
};
