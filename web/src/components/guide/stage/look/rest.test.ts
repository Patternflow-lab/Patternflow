import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { stageSignature, takeWake, wakeStage, watchForRest } from "./rest";

// The stage draws a frame only when its signature differs from the last one
// drawn (rest.ts). A change the signature misses is a picture that stays
// wrong on the screen, so each thing a frame is drawn from is changed here
// in turn, and each must move the number.

function stage() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 100);
  camera.position.set(4, 2, 11);
  const material = new THREE.MeshStandardMaterial({ color: "#eceae4", transparent: true });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);
  const light = new THREE.PointLight("#ffffff", 1);
  scene.add(light);
  const shader = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAt: { value: new THREE.Vector3() }, uList: { value: [new THREE.Color(0, 0, 0)] }, uTex: { value: null } } });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shader);
  scene.add(plane);
  const many = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial(), 4);
  scene.add(many);
  return { scene, camera, material, mesh, group, light, shader, plane, many };
}

describe("the stage's signature", () => {
  it("is the same number for the same picture", () => {
    const s = stage();
    expect(stageSignature(s.scene, s.camera)).toBe(stageSignature(s.scene, s.camera));
  });

  it("moves with each thing a frame is drawn from", () => {
    const s = stage();
    const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2);
    s.material.clippingPlanes = [plane];
    s.material.userData.uniforms = { uContact: { value: 0 } };
    s.shader.uniforms.uTex.value = texture;
    const changes: [string, () => void][] = [
      ["the camera's place", () => s.camera.position.x += 0.01],
      ["the camera's turn", () => s.camera.rotateY(0.01)],
      ["the camera's lens", () => {
        s.camera.setViewOffset(1600, 900, 40, 0, 1600, 900);
      }],
      ["an object's place", () => s.mesh.position.y += 0.001],
      ["an object's turn", () => s.mesh.rotateZ(0.001)],
      ["an object's size", () => s.mesh.scale.setScalar(0.5)],
      ["a parent's place", () => s.group.position.z -= 1],
      ["an object hidden", () => (s.mesh.visible = false)],
      ["an object shown again", () => (s.mesh.visible = true)],
      ["a material's opacity", () => (s.material.opacity = 0.5)],
      ["a material's colour", () => s.material.color.set("#151515")],
      ["a material's glow", () => s.material.emissive.set("#ff6a3d")],
      ["a material rebuilt", () => (s.material.needsUpdate = true)],
      ["a clipping plane", () => (plane.constant = 1)],
      ["a closure's uniform", () => (s.material.userData.uniforms.uContact.value = 0.4)],
      ["a shader's number", () => (s.shader.uniforms.uTime.value = 1.5)],
      ["a shader's vector", () => s.shader.uniforms.uAt.value.set(0, 1, 0)],
      ["a shader's list", () => s.shader.uniforms.uList.value[0].setRGB(0, 0.2, 0)],
      ["a texture written to", () => (texture.needsUpdate = true)],
      ["a buffer written to", () => (s.mesh.geometry.getAttribute("position").needsUpdate = true)],
      ["a draw range", () => s.mesh.geometry.setDrawRange(0, 6)],
      ["instances moved", () => (s.many.instanceMatrix.needsUpdate = true)],
      ["fewer instances", () => (s.many.count = 2)],
      ["a light's strength", () => (s.light.intensity = 0.3)],
      ["a light's colour", () => s.light.color.set("#ff0000")],
      ["an object added", () => s.scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))],
    ];
    let before = stageSignature(s.scene, s.camera);
    for (const [what, change] of changes) {
      change();
      const after = stageSignature(s.scene, s.camera);
      expect(after, what).not.toBe(before);
      before = after;
    }
  });

  it("leaves out what is hidden, whatever it is doing", () => {
    const s = stage();
    s.plane.visible = false;
    const before = stageSignature(s.scene, s.camera);
    // A hidden effect's clock runs on (the knobs' rings, the Wi-Fi's arcs): nothing of it is drawn.
    s.shader.uniforms.uTime.value = 9;
    s.plane.position.x = 3;
    expect(stageSignature(s.scene, s.camera)).toBe(before);
  });

  it("does not move for a change too small to see", () => {
    const s = stage();
    const before = stageSignature(s.scene, s.camera);
    // A spring's tail: a millionth of a unit, far under a pixel.
    s.mesh.position.x += 1e-7;
    s.camera.position.z += 1e-7;
    expect(stageSignature(s.scene, s.camera)).toBe(before);
  });

  it("reads what is watched from outside the scene", () => {
    const s = stage();
    const focus = { value: 4 };
    const forget = watchForRest(() => focus.value);
    const before = stageSignature(s.scene, s.camera);
    focus.value = 4.2;
    const moved = stageSignature(s.scene, s.camera);
    expect(moved).not.toBe(before);
    // Forgotten, it is no longer read.
    forget();
    const without = stageSignature(s.scene, s.camera);
    focus.value = 7;
    expect(stageSignature(s.scene, s.camera)).toBe(without);
  });

  it("names each object it reads to a probe", () => {
    const s = stage();
    s.mesh.name = "body";
    const seen: string[] = [];
    stageSignature(s.scene, s.camera, (o) => seen.push(o.name));
    expect(seen).toContain("body");
    s.group.visible = false;
    seen.length = 0;
    stageSignature(s.scene, s.camera, (o) => seen.push(o.name));
    expect(seen).not.toContain("body");
  });
});

describe("waking the stage", () => {
  it("is taken once", () => {
    expect(takeWake()).toBe(false);
    wakeStage();
    expect(takeWake()).toBe(true);
    expect(takeWake()).toBe(false);
  });
});
