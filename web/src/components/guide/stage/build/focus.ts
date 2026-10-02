import * as THREE from "three";

/**
 * What the build's current step is about, as a point on the stage: the joint
 * under the iron, the screw being driven, the plug going in. World units (the
 * camera's), written by BuildStage every frame it runs; `on` is false when
 * the build is not on stage or the step has no one subject (the whole bench,
 * the finished device) — then the camera's own target is the thing to look at.
 * `size` is roughly how big the subject is, world units (a joint 0.02, the
 * panel 3).
 *
 * For anything that wants to know where the eye should be: depth of field, a
 * light, a vignette. Nothing on the build stage reads it back.
 */
export const buildFocus = { on: false, world: new THREE.Vector3(), size: 1 };
