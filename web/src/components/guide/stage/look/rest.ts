import * as THREE from "three";

// The stage at rest.
//
// The frame loop runs for as long as the guide is open, and it used to draw
// every frame it ran. Most of a Build step is spent on a picture that does
// not move: the beat has played, the panel is dark until the power bank goes
// in, the reader is soldering. Each of those frames was the whole scene, its
// shadow map and the effects again, sixty times a second, for the picture
// already on the screen.
//
// So a frame is drawn only when it would differ from the last one drawn. The
// loop still runs every frame: the script, the springs and the simulated
// board go on as before. What is skipped is the drawing, and a canvas that
// is not drawn to keeps showing its last frame.
//
// "Would differ" is read off the scene itself (stageSignature): one number
// made from everything a frame is drawn from. No part of the stage has to
// say that it moved, so a part added later is covered the day it is added.
// What the scene cannot show is said in two ways:
//
//   watchForRest  a number the picture depends on that is not in the scene
//                 graph, such as an effect's uniform
//   wakeStage     "this frame differs", from a part that knows it without
//                 being asked. The panel says it while it is lit, which
//                 spares every frame of Play the walk through the scene.
//
// A material that keeps uniforms in a closure (onBeforeCompile) puts them on
// `userData.uniforms`, and they are read with the rest.
//
// The reading errs toward drawing. A value it does not know leaves the
// signature alone, so the heartbeat in StagePost draws once a second
// whatever the signature says: a change nothing here can see is on screen
// within that second.

/** Numbers are compared to this many parts of a unit: a hundredth of a pixel on the closest shot. */
const GRAIN = 1e5;

let h = 0;

function put(v: number) {
  h = Math.imul(h ^ (v | 0), 16777619);
  h ^= h >>> 15;
}
function putf(v: number) {
  put(Math.round(v * GRAIN));
}
function putColor(c: THREE.Color) {
  putf(c.r);
  putf(c.g);
  putf(c.b);
}
function putTexture(t: THREE.Texture) {
  put(t.id);
  put(t.version);
}

type Loose = {
  isTexture?: boolean;
  isColor?: boolean;
  elements?: ArrayLike<number>;
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  normal?: THREE.Vector3;
  constant?: number;
};

/** A uniform's value, whatever it is: a number, a vector, a colour, a matrix, a texture, or a list of those. */
function putValue(v: unknown) {
  if (typeof v === "number") putf(v);
  else if (typeof v === "boolean") put(v ? 1 : 0);
  else if (!v || typeof v !== "object") put(0);
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) putValue(v[i]);
  else {
    const o = v as Loose;
    if (o.isTexture) putTexture(v as THREE.Texture);
    else if (o.isColor) putColor(v as THREE.Color);
    else if (o.elements) for (let i = 0; i < o.elements.length; i++) putf(o.elements[i]);
    else if (o.normal && typeof o.constant === "number") {
      putValue(o.normal);
      putf(o.constant);
    } else if (typeof o.x === "number") {
      putf(o.x);
      if (typeof o.y === "number") putf(o.y);
      if (typeof o.z === "number") putf(o.z);
      if (typeof o.w === "number") putf(o.w);
    }
  }
}

function putUniforms(uniforms: Record<string, { value: unknown } | undefined>) {
  for (const key in uniforms) putValue(uniforms[key]?.value);
}

type AnyMaterial = THREE.Material &
  Partial<Pick<THREE.MeshStandardMaterial, "color" | "emissive" | "emissiveIntensity" | "roughness" | "metalness" | "map" | "emissiveMap" | "alphaMap">> &
  Partial<Pick<THREE.ShaderMaterial, "uniforms">> &
  Partial<Pick<THREE.SpriteMaterial, "rotation">> & {
    /** three numbers its materials as it makes them (its typings leave the number out). */
    id?: number;
  };

function putMaterial(m: AnyMaterial) {
  put(m.id ?? 0);
  put(m.version);
  put((m.visible ? 1 : 0) | (m.transparent ? 2 : 0) | (m.depthWrite ? 4 : 0));
  putf(m.opacity);
  if (m.color) putColor(m.color);
  if (m.emissive) {
    putColor(m.emissive);
    putf(m.emissiveIntensity ?? 1);
  }
  if (m.roughness !== undefined) putf(m.roughness);
  if (m.metalness !== undefined) putf(m.metalness);
  if (m.rotation !== undefined) putf(m.rotation);
  if (m.map) putTexture(m.map);
  if (m.emissiveMap) putTexture(m.emissiveMap);
  if (m.alphaMap) putTexture(m.alphaMap);
  if (m.clippingPlanes) putValue(m.clippingPlanes);
  if (m.uniforms) putUniforms(m.uniforms);
  // Uniforms a material hands its shader from a closure, and the solder's heat (look/materials.ts).
  const own = m.userData as { uniforms?: Record<string, { value: unknown }>; heat?: { value: number } };
  if (own.uniforms) putUniforms(own.uniforms);
  if (own.heat) putf(own.heat.value);
}

function putGeometry(g: THREE.BufferGeometry) {
  put(g.id);
  put(g.drawRange.start);
  // (An unbounded range is Infinity, which is 0 as an integer: still the same number every frame.)
  put(g.drawRange.count);
  if (g.index) put(g.index.version);
  const attributes = g.attributes;
  for (const name in attributes) put((attributes[name] as THREE.BufferAttribute).version);
}

type Drawn = THREE.Object3D & {
  material?: THREE.Material | THREE.Material[];
  geometry?: THREE.BufferGeometry;
  isInstancedMesh?: boolean;
  isLight?: boolean;
};

/** Called with each object that is read and the signature up to and including it (for finding what will not rest). */
export type SignatureProbe = (object: THREE.Object3D, soFar: number) => void;

function walk(o: Drawn, probe: SignatureProbe | undefined) {
  // What is hidden is not drawn, nor anything under it, whatever it is doing meanwhile.
  if (!o.visible) return;
  put(o.id);
  const p = o.position;
  const q = o.quaternion;
  const s = o.scale;
  putf(p.x);
  putf(p.y);
  putf(p.z);
  putf(q.x);
  putf(q.y);
  putf(q.z);
  putf(q.w);
  putf(s.x);
  putf(s.y);
  putf(s.z);
  put((o.castShadow ? 1 : 0) | (o.receiveShadow ? 2 : 0));
  put(o.renderOrder);
  const material = o.material;
  if (material) {
    if (Array.isArray(material)) for (let i = 0; i < material.length; i++) putMaterial(material[i]);
    else putMaterial(material);
  }
  if (o.geometry) putGeometry(o.geometry);
  if (o.isInstancedMesh) {
    const inst = o as unknown as THREE.InstancedMesh;
    put(inst.count);
    put(inst.instanceMatrix.version);
    if (inst.instanceColor) put(inst.instanceColor.version);
  }
  if (o.isLight) {
    const light = o as unknown as THREE.SpotLight;
    putf(light.intensity);
    putColor(light.color);
    if (typeof light.angle === "number") {
      putf(light.angle);
      putf(light.penumbra);
    }
  }
  if (probe) probe(o, h);
  const children = o.children;
  for (let i = 0; i < children.length; i++) walk(children[i], probe);
}

const watched = new Set<() => number>();

/**
 * A number the picture depends on that the scene does not hold: an effect's
 * uniform, say. Read once a frame. Returns its undoing.
 */
export function watchForRest(read: () => number): () => void {
  watched.add(read);
  return () => {
    watched.delete(read);
  };
}

let woken = false;

/** This frame differs from the last, said by a part that knows: it is drawn without the scene being read. */
export function wakeStage() {
  woken = true;
}

/** Was the stage woken since this was last asked? */
export function takeWake(): boolean {
  const was = woken;
  woken = false;
  return was;
}

/**
 * One number for everything this frame would be drawn from: the camera, and
 * for each visible object its place, its material, its buffers and its light.
 * Two frames with the same number are the same picture.
 */
export function stageSignature(scene: THREE.Object3D, camera: THREE.Camera, probe?: SignatureProbe): number {
  h = 0x811c9dc5 | 0;
  putValue(camera.position);
  putValue(camera.quaternion);
  putValue(camera.projectionMatrix);
  const world = scene as THREE.Scene;
  if (world.environment) putTexture(world.environment);
  walk(scene, probe);
  for (const read of watched) putf(read());
  return h;
}
