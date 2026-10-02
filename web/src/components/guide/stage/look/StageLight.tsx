"use client";

/* eslint-disable react-hooks/immutability --
   Lights and materials are imperative three.js objects driven from the frame
   loop; that is their API and it never feeds back into React. */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGuideStore } from "../../store";
import { LED_CENTER_WORLD } from "../geometry";
import { LED_GAIN, ledPanelTexture } from "./ledPanel";
import { GLOW_BANDS, panelGlow } from "./panelGlow";
import { grainTexture } from "./textures";

// The LED panel as a light.
//
// The panel is the brightest thing in the room and the only coloured one, and
// what it shows changes all the time; the room has to answer it. Three things
// do, all fed by what the panel is showing right now (panelGlow.ts, and the
// panel's own texture):
//
//   PanelLights  three small lights standing just off the panel's face, one
//                per third of its height, each the colour of its third. They
//                stand close to the face, so the case's front — which the
//                panel is flush with, and cannot light — takes them only at a
//                graze, while what stands proud of it or faces it does: the
//                knobs' flanks, the bench, a part held in front.
//   StageFloor   the floor mirrors the panel: a rough, dark, slightly glossy
//                surface, so the mirror image is a soft smear drawn out
//                toward the eye, in the pattern's own colours, strongest at a
//                graze. And where the device stands on it, the dark gathers.
//   PanelAir     the veil a bright thing has round it in a dark room, to the
//                eye and to a lens: the panel's colour, faint, reaching out
//                past its edges into the dark.
//
// None of them has a shadow (see GuideCanvas: on the Build guide the lights
// go out as the camera comes round behind the panel, or its open back would
// glow), and all three are always there — at nothing when the panel is dark
// — so no shader is rebuilt when it lights.

/** The panel's lit face, world units: its left, foot, right and top edges, and its plane. */
const FACE = { x0: LED_CENTER_WORLD.x - 0.8, y0: LED_CENTER_WORLD.y - 1.6, x1: LED_CENTER_WORLD.x + 0.8, y1: LED_CENTER_WORLD.y + 1.6, z: 0.15 };
/** How far off the face the lights stand. */
const LIGHT_OFF = 0.16;
/** Candela of a band at full white, before the knee. */
const LIGHT_GAIN = 6;
/** The floor (GuideCanvas has always had it here). */
const FLOOR_Y = -1.66;
/** The case's footprint on the floor: centre x, z and half-sizes. */
const FOOT = new THREE.Vector4(0, 0.085, 1.24, 0.29);

/** 1 with the camera in front of the panel, 0 behind it — on the Build guide, where the panel's back stands open. */
function frontOf(camera: THREE.Camera) {
  if (useGuideStore.getState().page !== "build") return 1;
  return THREE.MathUtils.clamp((camera.position.z + 0.3) / 0.6, 0, 1);
}

export function PanelLights() {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  useFrame((state) => {
    const front = frontOf(state.camera);
    for (let k = 0; k < GLOW_BANDS; k++) {
      const l = lights.current[k];
      if (!l) continue;
      const c = panelGlow.bands[k];
      const peak = Math.max(c.r, c.g, c.b);
      if (peak > 1e-4) l.color.setRGB(c.r / peak, c.g / peak, c.b / peak);
      // A knee: a third of the panel in full white is not five times a pattern's worth of light on the case.
      l.intensity = ((LIGHT_GAIN * peak) / (1 + 2.2 * peak)) * front;
    }
  });
  const h = (FACE.y1 - FACE.y0) / GLOW_BANDS;
  return (
    <>
      {Array.from({ length: GLOW_BANDS }, (_, k) => (
        <pointLight
          key={k}
          ref={(l) => {
            lights.current[k] = l;
          }}
          position={[(FACE.x0 + FACE.x1) / 2, FACE.y0 + h * (k + 0.5), FACE.z + LIGHT_OFF]}
          intensity={0}
          distance={5.5}
          decay={2}
        />
      ))}
    </>
  );
}

// ── the air ─────────────────────────────────────────────────────────────────

const airVert = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const airFrag = /* glsl */ `
uniform vec3 uBands[${GLOW_BANDS}];
uniform vec2 uHalf;
uniform float uFade;
varying vec2 vP;
void main() {
  // How far outside the face, in world units (0 on it).
  vec2 q = abs(vP) - uHalf;
  float d = length(max(q, 0.0));
  // The colour of the nearest height: the thirds, run together.
  float t = clamp(vP.y / (2.0 * uHalf.y) + 0.5, 0.0, 1.0) * ${GLOW_BANDS.toFixed(1)} - 0.5;
  vec3 col = mix(uBands[0], uBands[1], smoothstep(0.0, 1.0, t));
  col = mix(col, uBands[2], smoothstep(1.0, 2.0, t));
  // Close in, a tight glow; further out, a long faint one.
  float veil = 0.65 * exp(-d * d / 0.02) + 0.35 * exp(-d / 0.4);
  // Over the face itself, less: its blacks are what make it read as LEDs.
  veil *= mix(0.18, 1.0, smoothstep(-0.03, 0.05, max(q.x, q.y)));
  gl_FragColor = vec4(col * veil * uFade, 0.0);
}
`;

export function PanelAir() {
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uBands: { value: panelGlow.bands },
        uHalf: { value: new THREE.Vector2((FACE.x1 - FACE.x0) / 2, (FACE.y1 - FACE.y0) / 2) },
        uFade: { value: 0 },
      },
      vertexShader: airVert,
      fragmentShader: airFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      // Adds light and leaves alpha alone: the canvas is transparent over the page (Fx.tsx lightOnly).
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    return m;
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    // From the front only: square on it is strongest, and it is gone by the time the panel is edge on.
    const cam = state.camera.position;
    const dz = cam.z - FACE.z;
    const dist = Math.hypot(cam.x - LED_CENTER_WORLD.x, cam.y - LED_CENTER_WORLD.y, dz);
    const facing = THREE.MathUtils.clamp(dz / Math.max(dist, 1e-3), 0, 1);
    const fade = 0.15 * LED_GAIN * Math.min(1, facing * 1.6) * frontOf(state.camera);
    mat.uniforms.uFade.value = fade;
    if (mesh.current) mesh.current.visible = fade > 0.002 && panelGlow.power > 0.002;
  });
  return (
    <mesh ref={mesh} position={[LED_CENTER_WORLD.x, LED_CENTER_WORLD.y, FACE.z + 0.02]} renderOrder={4} material={mat} frustumCulled={false}>
      <planeGeometry args={[(FACE.x1 - FACE.x0) + 4.4, (FACE.y1 - FACE.y0) + 4.4]} />
    </mesh>
  );
}

// ── the floor ───────────────────────────────────────────────────────────────
//
// Something for the device to stand on, fading into the dark well before its
// edges. It is nearly black, so what it shows of the panel is not a spill of
// colour on it (a black thing has no colour to give back) but the panel's
// reflection: rough, so blurred — more the further the light has travelled —
// and drawn out toward the eye, as a wet road draws out a lamp; Fresnel, so
// it is strong at a graze and almost nothing from above.

export function StageFloor() {
  const scene = useThree((s) => s.scene);
  const alpha = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, "#8a8a8a");
      g.addColorStop(1, "#000000");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    return new THREE.CanvasTexture(c);
  }, []);

  const { mat, uniforms } = useMemo(() => {
    const uniforms = {
      uPanel: { value: ledPanelTexture() as THREE.Texture },
      uPanelRect: { value: new THREE.Vector4(FACE.x0, FACE.y0, FACE.x1, FACE.y1) },
      uPanelZ: { value: FACE.z },
      // The panel's power × its gain, and how much of the device stands on the floor (0 … 1).
      uPanelPower: { value: 0 },
      uContact: { value: 0 },
      uFoot: { value: FOOT },
      // The case's front face: its centre x, y and half-sizes.
      uCase: { value: new THREE.Vector4(0, -0.025, 1.23, 1.605) },
      uTooth: { value: grainTexture() as THREE.Texture },
    };
    const mat = new THREE.MeshStandardMaterial({ color: "#141210", roughness: 0.92, metalness: 0, transparent: true, alphaMap: alpha });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vFloorW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvFloorW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
varying vec3 vFloorW;
uniform sampler2D uPanel;
uniform vec4 uPanelRect;
uniform float uPanelZ;
uniform float uPanelPower;
uniform float uContact;
uniform vec4 uFoot;
uniform vec4 uCase;
uniform sampler2D uTooth;

// The device as the floor sees it at p, looking along view (from the eye):
// the panel's light, and round it the pale of the case's face.
vec3 floorMirror(vec3 p, vec3 view) {
  // Only in front of the device, and not out where the floor has faded away.
  if (p.z < uPanelZ || p.z > uPanelZ + 5.0 || abs(p.x) > 3.4) return vec3(0.0);
  vec2 toEye = -normalize(view.xz + vec2(1e-5));
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  float lastUp = -1.0;
  // A rough floor is many small mirrors, each leaning a little along the line
  // to the eye. Seen at a graze it is the ones leaning toward the eye that
  // show, and those look higher up the device: the smear a lamp leaves on a
  // wet road — drawn out toward the eye, and hardly spread sideways at all.
  // Six of them, fewer the further they lean; each is read through a
  // footprint as long as the gap to the next (the sampler's anisotropic
  // filter does the smearing), so the six never show as six.
  for (int i = 0; i < 6; i++) {
    float f = float(i);
    float lean = -0.06 + f * (0.045 + f * 0.0094);
    float w = exp(-f * 0.3) * (i == 0 ? 0.6 : 1.0);
    wsum += w;
    vec3 r = reflect(view, normalize(vec3(toEye.x * lean, 1.0, toEye.y * lean)));
    if (r.z > -1e-3) continue;
    float t = (uPanelZ - p.z) / r.z;
    if (t <= 0.0) continue;
    vec3 hit = p + r * t;
    float across = (hit.x - uPanelRect.x) / (uPanelRect.z - uPanelRect.x);
    float up = (hit.y - uPanelRect.y) / (uPanelRect.w - uPanelRect.y);
    float along = lastUp < 0.0 ? 0.06 : clamp(abs(up - lastUp), 0.03, 0.4);
    lastUp = up;
    // Sideways it blurs with how far the light came, and the panel's edges are soft by as much.
    float side = 0.012 + 0.035 * t;
    float inPanel = smoothstep(-side, side, min(across, 1.0 - across)) * smoothstep(-along * 0.5, along * 0.5, min(up, 1.0 - up));
    vec3 light = textureGrad(uPanel, vec2(clamp(up, 0.0, 1.0), 1.0 - clamp(across, 0.0, 1.0)), vec2(along, 0.0), vec2(0.0, side)).rgb * (inPanel * uPanelPower);
    // The case's face round the panel: white PLA under the key light.
    vec2 c = (hit.xy - uCase.xy) / uCase.zw;
    float inCase = smoothstep(-side, side, 1.0 - abs(c.x)) * smoothstep(-along * 0.5, along * 0.5, 1.0 - abs(c.y));
    light += vec3(0.5, 0.485, 0.46) * (inCase * (1.0 - inPanel) * uContact);
    sum += light * (w / (1.0 + 0.35 * t));
  }
  return sum / max(wsum, 1e-3);
}`,
        )
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
// Where the case stands: the light cannot get under it, and little gets near.
vec2 footQ = abs(vFloorW.xz - uFoot.xy) - uFoot.zw;
float footD = max(length(max(footQ, 0.0)) + min(max(footQ.x, footQ.y), 0.0), 0.0);
float contact = 1.0 - uContact * (0.6 * exp(-footD / 0.06) + 0.32 * exp(-footD / 0.42));
diffuseColor.rgb *= contact;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          /* glsl */ `#include <emissivemap_fragment>
if (uPanelPower + uContact > 0.001) {
  vec3 floorView = normalize(vFloorW - cameraPosition);
  float fres = 0.04 + 0.96 * pow(1.0 - clamp(-floorView.y, 0.0, 1.0), 5.0);
  // No floor is evenly smooth: the mirror is a little stronger here and weaker there.
  float floorTooth = 0.7 + 0.6 * texture2D(uTooth, vFloorW.xz * 0.9).b;
  totalEmissiveRadiance += floorMirror(vFloorW, floorView) * (fres * 1.1 * floorTooth) * mix(1.0, contact, 0.6);
}`,
        );
    };
    mat.customProgramCacheKey = () => "look-floor-1";
    return { mat, uniforms };
  }, [alpha]);

  useEffect(
    () => () => {
      mat.dispose();
      alpha.dispose();
    },
    [mat, alpha],
  );

  const body = useRef<THREE.Mesh | null>(null);
  const contact = useRef(0);
  useFrame((state, dt) => {
    uniforms.uPanelPower.value = panelGlow.power * LED_GAIN * frontOf(state.camera);
    // The case's shade on the floor is there while the case is: on the Build
    // guide it is printed, bonded and brought in part-way through, and until
    // then (its body hidden, faded, or somewhere else) the floor is bare.
    const b = (body.current ??= (scene.getObjectByName("body") as THREE.Mesh | undefined) ?? null);
    let want = 0;
    if (b && b.visible && b.parent) {
      const home = b.userData.home as THREE.Vector3 | undefined;
      const moved = home ? b.position.distanceToSquared(home) : b.position.lengthSq();
      const m = b.material as THREE.MeshStandardMaterial;
      if (moved < 1e-4 && Math.abs(b.quaternion.w) > 0.9999) want = m.transparent ? m.opacity : 1;
    }
    contact.current += (want - contact.current) * Math.min(1, dt * 6);
    uniforms.uContact.value = contact.current;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0.4]} receiveShadow material={mat}>
      <circleGeometry args={[7, 64]} />
    </mesh>
  );
}
