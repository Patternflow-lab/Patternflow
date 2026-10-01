"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { smoothDamp, type Damp } from "./damp";
import { EXPLODE_WHOLE, explodeState, explodeWanted, partOffset } from "./explodeParts";
import { KNOB_MESH_TO_LOGICAL } from "./geometry";
import { PCB_PLACEMENT } from "./parts";
import { useGuideStore } from "../store";

// The device coming apart and going back together (explodeParts.ts has what moves
// where; this puts it on the device's objects).
//
// Mounted straight after <Device />, so each frame it runs after Device has
// put the knobs, the DevKit and the back cover where the board has them: to
// those it adds its displacement; the parts Device leaves alone (the panel,
// the lid, the board, the back plate) it places outright, from their homes.
// When the amount is back at 0 every part is written home once, exactly, and
// this does nothing more — which is when the Build stage, if it is waiting,
// takes the device over (BuildStage reads explodeState).
//
// Nothing here turns the panel off: taken apart, the back cover is off its
// rails and the DevKit off its pins, and KitFx keeps a device in that state
// dark until it is whole again, as it does in the guides.

/**
 * How quickly the amount follows, seconds (damp.ts): apart, back together,
 * and back together in a hurry — the reader has chosen Build and is already
 * scrolling into it, where the Build stage is waiting for a whole device.
 */
const OUT_S = 0.42;
const HOME_S = 0.4;
const HURRY_S = 0.16;

type Rig = {
  knobs: THREE.Object3D[];
  rings: THREE.Object3D[];
  devkit: THREE.Object3D;
  slider: THREE.Object3D;
  /** The parts placed outright, each with its home. */
  placed: { part: "panel" | "lid" | "board" | "backPlate"; node: THREE.Object3D; home: THREE.Vector3 }[];
};

function find(world: THREE.Object3D): Rig | null {
  const root = world.getObjectByName("patternflow");
  if (!root) return null;
  const get = (n: string) => root.getObjectByName(n);
  const devkit = get("devkit_pivot");
  const slider = get("back_slider");
  const panel = get("l");
  const lid = get("top_lid");
  const board = get("pcb_v39");
  const backPlate = get("back_plate");
  const knobs = Object.keys(KNOB_MESH_TO_LOGICAL).map(get);
  if (!devkit || !slider || !panel || !lid || !board || !backPlate || knobs.some((k) => !k)) return null;
  const home = (o: THREE.Object3D) => ((o.userData.home as THREE.Vector3 | undefined) ?? o.position).clone();
  const placed: Rig["placed"] = [
    { part: "panel", node: panel, home: home(panel) },
    { part: "lid", node: lid, home: home(lid) },
    { part: "board", node: board, home: PCB_PLACEMENT.position.clone() },
    { part: "backPlate", node: backPlate, home: home(backPlate) },
  ];
  // The floor of the back plate's snap notch (Device) is the plate's.
  const notch = get("notch_floor");
  if (notch) placed.push({ part: "backPlate", node: notch, home: home(notch) });
  const rings: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.name === "knob_ring") rings.push(o);
  });
  return { knobs: knobs as THREE.Object3D[], rings, devkit, slider, placed };
}

export default function Explode() {
  const world = useThree((s) => s.scene);
  const rig = useRef<Rig | null>(null);
  const st = useRef<{ e: number; vel: Damp }>({ e: 0, vel: { v: 0 } });
  const o = useMemo(() => new THREE.Vector3(), []);

  // Gone with the canvas: nothing is apart.
  useEffect(
    () => () => {
      explodeState.amount = 0;
    },
    [],
  );

  useFrame((_, rawDt) => {
    const s = st.current;
    const want = explodeWanted() ? 1 : 0;
    if (want === 0 && s.e === 0) return;
    const dt = Math.min(rawDt, 1 / 20);
    const { page, scene } = useGuideStore.getState();
    const hurry = page !== "hub" && scene !== "opening";
    let e = smoothDamp(s.e, want, s.vel, want ? OUT_S : hurry ? HURRY_S : HOME_S, dt);
    if (want === 0 && e < EXPLODE_WHOLE) {
      e = 0;
      s.vel.v = 0;
    } else if (want === 1 && e > 1 - EXPLODE_WHOLE) e = 1;
    const r = (rig.current ??= find(world));
    if (!r) {
      // The device has not loaded yet: nothing has moved.
      s.e = 0;
      s.vel.v = 0;
      return;
    }
    s.e = e;
    explodeState.amount = e;

    // Added to where Device has just put them.
    partOffset("knobs", e, o);
    for (const k of r.knobs) k.position.z += o.z;
    for (const ring of r.rings) ring.position.z += o.z;
    r.devkit.position.add(partOffset("devkit", e, o));
    r.slider.position.add(partOffset("slider", e, o));
    // Placed from home.
    for (const p of r.placed) p.node.position.copy(p.home).add(partOffset(p.part, e, o));
  });

  return null;
}
