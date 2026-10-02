import * as THREE from "three";
import { MODEL_OFFSET, MODEL_SCALE } from "./geometry";
import { EXPLODE } from "./explodeParts";
import type { View } from "./views";

// The hub's own camera views (GuideCanvas CameraRig), in views.ts's terms.
// The hub plays Play's opening — the device turning slowly — and these are
// for what it shows besides, while a guide is pointed at. The Build guide
// opens on the same view of the same device (explodeParts.ts explodeWanted),
// in the room its title leaves.

const w = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);

// The device taken apart (explodeParts.ts): its parts are strung out along z, the
// knobs in front and the back plate behind, with the two sliding covers out
// to the right. Seen from the knob side and a little above, well round from
// the front: from the front the layers hide one another, from the side they
// are edges.
//
// The frame goes a little below the floor (FOOT). The parts nearest the
// camera — the lid over the power-bank tray, out to the right and forward —
// hang lowest on screen, and fitted to the device's own height the lid's
// corner came down to within a line of the hub's "Start where you are.":
// the picture had no air at its foot.
const front = Math.max(3.65 + EXPLODE.knobs.offset[2], 1.5 + EXPLODE.panel.offset[2]);
const back = -1.95 + EXPLODE.backPlate.offset[2];
const right = 12.3 + Math.max(EXPLODE.lid.offset[0], EXPLODE.slider.offset[0]);
const FOOT = -3.4;
const exploded: View = {
  target: w(0.6, 16.3, (front + back) / 2),
  dir: new THREE.Vector3(0.86, 0.3, 0.72).normalize(),
  minR: 13.2,
  frame: [-12.5, right].flatMap((x) => [FOOT, 32.6].flatMap((y) => [back, front].map((z) => w(x, y, z)))),
  fill: 0.9,
};

export const HUB_VIEWS = { exploded } satisfies Record<string, View>;
