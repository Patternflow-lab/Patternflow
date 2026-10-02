import * as THREE from "three";

// Where the camera is looking and from how far, for the depth of field
// (StagePost.tsx). The camera rig (GuideCanvas) writes it every frame: the
// point its springs have the camera aimed at, and the distance to it.

export const stageFocus = { target: new THREE.Vector3(), r: 10 };
