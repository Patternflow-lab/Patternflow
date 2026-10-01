import * as THREE from "three";
import { MODEL_OFFSET, MODEL_SCALE } from "./geometry";
import { EXPLODE } from "./explodeParts";
import type { View } from "./views";

// The hub's own camera views (GuideCanvas CameraRig), in views.ts's terms.
// The hub plays Play's opening — the device turning slowly — and these are
// for what it shows besides, while a guide is pointed at.

const w = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);

// The device taken apart (explodeParts.ts): its parts are strung out along z, the
// knobs in front and the back plate behind, with the two sliding covers out
// to the right. Seen from the knob side and a little above, well round from
// the front: from the front the layers hide one another, from the side they
// are edges.
const front = Math.max(3.65 + EXPLODE.knobs.offset[2], 1.5 + EXPLODE.panel.offset[2]);
const back = -1.95 + EXPLODE.backPlate.offset[2];
const right = 12.3 + Math.max(EXPLODE.lid.offset[0], EXPLODE.slider.offset[0]);
const exploded: View = {
  target: w(0.6, 16.3, (front + back) / 2),
  dir: new THREE.Vector3(0.86, 0.3, 0.72).normalize(),
  minR: 13.2,
  frame: [-12.5, right].flatMap((x) => [0, 32.6].flatMap((y) => [back, front].map((z) => w(x, y, z)))),
  fill: 0.9,
};

export const HUB_VIEWS = { exploded } satisfies Record<string, View>;
