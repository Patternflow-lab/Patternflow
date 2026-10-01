import * as THREE from "three";
import { grainTexture, LAYER_TILE, layerTexture, turnedTexture } from "./textures";

// What the stage's things are made of. One place for it, so the device on
// the hub, in Play and on the Build guide's bench is the same object under
// the same light: the Device uses these, and the Build stage's own parts
// (its print plates, the halves of the case, its screws and nuts, its solder)
// are meant to as well.
//
// Every one is a MeshStandardMaterial with a little added to its shader, so
// it takes whatever a standard material takes — `transparent`, `opacity`,
// `clippingPlanes`, `side` — through `extra`, fades and clips as before, and
// costs one or two texture reads more than the plain material it replaces.
// The detail is in mipmapped textures (textures.ts), so it resolves up close
// and is simply gone from a distance, without shimmer in between.
//
// Sizes are in the mesh's own units. The device and the build's parts are in
// model units, 10 mm each (geometry.ts): a 0.2 mm layer is 0.02.

type Extra = Partial<THREE.MeshStandardMaterialParameters>;
export type Axis = "x" | "y" | "z";

const AXES: Record<Axis, [THREE.Vector3, THREE.Vector3, THREE.Vector3]> = {
  // [the axis, and the two directions of a face across it]
  x: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
  y: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)],
  z: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
};

/** The stage's colours for what is printed and what is metal. */
export const LOOK = {
  /** Warm white PLA: the case. */
  pla: "#eceae4",
  /** Black PLA: the knobs. */
  plaBlack: "#151515",
  /** Zinc-plated steel: the M4 screws. */
  screw: "#c6c9ce",
  /** Brushed steel: the encoders' bushings, washers and nuts. */
  steel: "#8d9096",
  /** Gold-flashed contacts: header pins, socket springs. */
  gold: "#d9b56a",
  /** Brass: threaded inserts. */
  brass: "#a8853f",
  /** Tin: HASL pads, solder. */
  tin: "#dfe0dc",
} as const;

/**
 * three's Material.clone() copies a material's properties but not what was
 * put on its shader (onBeforeCompile is the instance's own), so a clone of
 * one of these would be a plain material. The Device clones every material
 * it is handed; so each of these knows how to make itself again.
 */
function cloneable(m: THREE.MeshStandardMaterial, again: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.clone = function (this: THREE.MeshStandardMaterial) {
    const c = again();
    const own = c.userData;
    THREE.MeshStandardMaterial.prototype.copy.call(c, this);
    // copy() replaces userData with a JSON copy: put the new material's own (its live uniforms) back.
    c.userData = own;
    return c;
  } as THREE.MeshStandardMaterial["clone"];
  return m;
}

const VERT_COMMON = /* glsl */ `#include <common>
uniform vec3 uLkAxis;
uniform vec3 uLkU;
uniform vec3 uLkV;
varying vec3 vLkPos;
varying vec3 vLkN;
varying vec3 vLkAxisV;
varying vec3 vLkUV;
varying vec3 vLkVV;`;

// The object's own directions in view space (normalMatrix is a rotation over
// a uniform scale for everything on the stage; the fragment normalises).
const VERT_BEGIN = /* glsl */ `#include <begin_vertex>
vLkPos = position;
vLkN = normal;
mat3 lkM = normalMatrix;
#ifdef USE_INSTANCING
lkM = lkM * mat3(instanceMatrix);
#endif
vLkAxisV = lkM * uLkAxis;`;

// ── printed PLA ─────────────────────────────────────────────────────────────

export type PlaOptions = {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  /** The print axis in the mesh's own frame: its layers stack along it. The case, as it sits in the device, was printed lying on its face: z. On a print plate: y. */
  axis?: Axis;
  /** Layer height, mesh units (0.02 = 0.2 mm in model units). */
  layer?: number;
  /** 0 … 1: how much of the print shows (1). */
  strength?: number;
  extra?: Extra;
};

/**
 * Printed PLA. Its walls carry the layers — each a rounded bead, so a wall's
 * highlight is drawn out across them, with the faint banding of a real print
 * — and the faces across the print axis carry the fine tooth of the plate it
 * lay on. All of it is finer than a pixel from where the whole device is
 * seen, and is filtered away there; it shows as the camera comes close.
 */
export function plaMaterial(o: PlaOptions = {}): THREE.MeshStandardMaterial {
  const [axis, u, v] = AXES[o.axis ?? "z"];
  const layer = o.layer ?? 0.02;
  const strength = o.strength ?? 1;
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? LOOK.pla, roughness: o.roughness ?? 0.56, metalness: 0, ...o.extra });
  const uniforms = {
    uLkAxis: { value: axis },
    uLkU: { value: u },
    uLkV: { value: v },
    uLkLayers: { value: layerTexture() },
    uLkGrain: { value: grainTexture() },
    // 1 / a tile of layers; 1 / a tile of grain (about 12 mm in model units); the two strengths.
    uLkScale: { value: new THREE.Vector4(1 / (LAYER_TILE * layer), 1 / (layer * 64), strength, strength) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", VERT_COMMON)
      .replace("#include <begin_vertex>", `${VERT_BEGIN}\nvLkUV = lkM * uLkU;\nvLkVV = lkM * uLkV;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform vec3 uLkAxis;
uniform vec3 uLkU;
uniform vec3 uLkV;
uniform vec4 uLkScale;
uniform sampler2D uLkLayers;
uniform sampler2D uLkGrain;
varying vec3 vLkPos;
varying vec3 vLkN;
varying vec3 vLkAxisV;
varying vec3 vLkUV;
varying vec3 vLkVV;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
// A wall (its normal across the print axis) or a face (along it).
float lkWall = smoothstep(0.3, 0.8, 1.0 - abs(dot(normalize(vLkN), uLkAxis)));
float lkFace = 1.0 - lkWall;
vec4 lkL = texture2D(uLkLayers, vec2(dot(vLkPos, uLkAxis) * uLkScale.x, 0.5)) - 0.5;
vec4 lkG = texture2D(uLkGrain, vec2(dot(vLkPos, uLkU), dot(vLkPos, uLkV)) * uLkScale.y) - 0.5;
diffuseColor.rgb *= 1.0 + lkL.b * 0.075 * lkWall * uLkScale.z;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (lkL.g * 0.3 + 0.05) * lkWall * uLkScale.z + (lkG.b * 0.2 - 0.03) * lkFace * uLkScale.w, 0.06, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
normal = normalize(normal
  + normalize(vLkAxisV) * (lkL.r * 0.55 * lkWall * uLkScale.z)
  + (normalize(vLkUV) * lkG.r + normalize(vLkVV) * lkG.g) * (0.42 * lkFace * uLkScale.w));`,
      );
  };
  m.customProgramCacheKey = () => "look-pla-1";
  return cloneable(m, () => plaMaterial(o));
}

/** The knobs: black PLA, printed standing on their skirts (their axis is the print's). */
export function knobMaterial(extra?: Extra): THREE.MeshStandardMaterial {
  return plaMaterial({ color: LOOK.plaBlack, roughness: 0.74, axis: "z", extra });
}

// ── metal ───────────────────────────────────────────────────────────────────

export type MetalOptions = {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  /** The axis the part was turned about, in the mesh's own frame: the marks run round it on its end faces and round its sides. */
  axis?: Axis;
  /** The spacing of the broad marks, mesh units (0.05 = half a millimetre in model units). */
  pitch?: number;
  /** 0 … 1: how strongly the marks show (1). */
  strength?: number;
  extra?: Extra;
};

/**
 * Turned metal: a lathe's fine concentric marks on the end faces (a screw's
 * head, a washer) and round the sides, as a slope and a roughness. Enough to
 * draw a highlight out into the arc turned parts have, and no more.
 */
export function turnedMetal(o: MetalOptions = {}): THREE.MeshStandardMaterial {
  const [axis] = AXES[o.axis ?? "y"];
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? LOOK.steel, roughness: o.roughness ?? 0.42, metalness: o.metalness ?? 0.9, ...o.extra });
  const uniforms = {
    uLkAxis: { value: axis },
    uLkU: { value: axis },
    uLkV: { value: axis },
    uLkTurned: { value: turnedTexture() },
    uLkScale: { value: new THREE.Vector4(1 / ((o.pitch ?? 0.05) * 16), 0, o.strength ?? 1, 0) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", VERT_COMMON).replace(
      "#include <begin_vertex>",
      /* glsl */ `${VERT_BEGIN}
vec3 lkRad = position - uLkAxis * dot(position, uLkAxis);
vLkUV = lkM * (lkRad / max(length(lkRad), 1e-5));
vLkVV = vLkUV;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform vec3 uLkAxis;
uniform vec4 uLkScale;
uniform sampler2D uLkTurned;
varying vec3 vLkPos;
varying vec3 vLkN;
varying vec3 vLkAxisV;
varying vec3 vLkUV;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
// An end face (marks run round the axis, read along the radius) or the side (read along the axis).
float lkEnd = smoothstep(0.5, 0.9, abs(dot(normalize(vLkN), uLkAxis)));
float lkAlong = dot(vLkPos, uLkAxis);
vec4 lkT = texture2D(uLkTurned, vec2(mix(lkAlong, length(vLkPos - uLkAxis * lkAlong), lkEnd) * uLkScale.x, 0.5)) - 0.5;
roughnessFactor = clamp(roughnessFactor + lkT.g * 0.26 * uLkScale.z, 0.06, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
normal = normalize(normal + normalize(mix(vLkAxisV, vLkUV, lkEnd) + vec3(1e-5)) * (lkT.r * 0.55 * uLkScale.z));`,
      );
  };
  m.customProgramCacheKey = () => "look-turned-1";
  return cloneable(m, () => turnedMetal(o));
}

/** Zinc-plated steel: an M4 screw (props.ts' screw stands on +y). Bright, but a satin bright — nothing here is a mirror, mirrors bloom. */
export function screwMaterial(extra?: Extra) {
  return turnedMetal({ color: LOOK.screw, roughness: 0.34, metalness: 0.9, axis: "y", extra });
}

/** Brushed steel: the encoders' washers and nuts (on +y), anything turned and left satin. */
export function steelMaterial(extra?: Extra) {
  return turnedMetal({ color: LOOK.steel, roughness: 0.52, metalness: 0.8, axis: "y", extra });
}

/** Gold-flashed contacts: header pins, the sockets' springs. */
export function goldMaterial(extra?: Extra) {
  return new THREE.MeshStandardMaterial({ color: LOOK.gold, roughness: 0.34, metalness: 1, ...extra });
}

/** Brass: the panel's threaded inserts. */
export function brassMaterial(extra?: Extra) {
  return new THREE.MeshStandardMaterial({ color: LOOK.brass, roughness: 0.46, metalness: 0.9, ...extra });
}

// ── solder ──────────────────────────────────────────────────────────────────

/**
 * Solder, with its heat. Cold it is tin: bright, a little frosted. Hot
 * (`heat` 1) it is liquid — a mirror, which is how molten solder shows its
 * heat: it does not glow (at 250 °C nothing does), it goes bright and clean
 * and frosts over as it sets. A trace of warmth is left in it, no brighter
 * than the board round it; lit like a lamp, a row of fresh joints read as a
 * string of LEDs. The heat is `material.userData.heat.value` for the whole material
 * (setSolderHeat), or per instance: give the InstancedMesh's geometry an
 * `aHeat` InstancedBufferAttribute (one float each, 0 … 1) and each joint
 * cools on its own. Without the attribute it reads 0.
 */
export function solderMaterial(extra?: Extra): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: LOOK.tin, roughness: 0.34, metalness: 1, ...extra });
  const heat = { value: 0 };
  m.userData.heat = heat;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLkHeat = heat;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aHeat;\nvarying float vLkHeat;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLkHeat = aHeat;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLkHeat;\nvarying float vLkHeat;")
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
float lkHeat = clamp(max(uLkHeat, vLkHeat), 0.0, 1.0);
roughnessFactor = mix(roughnessFactor, 0.045, lkHeat);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.36, 0.08) * (lkHeat * lkHeat * 0.15);`,
      );
  };
  m.customProgramCacheKey = () => "look-solder-2";
  return cloneable(m, () => {
    const c = solderMaterial();
    setSolderHeat(c, heat.value);
    return c;
  });
}

/** The whole material's heat, 0 cold … 1 molten. */
export function setSolderHeat(m: THREE.Material, heat: number) {
  const u = m.userData.heat as { value: number } | undefined;
  if (u) u.value = heat;
}

// ── the board ───────────────────────────────────────────────────────────────

type Tune = { color?: string; roughness: number; metalness: number; env?: number };

// pcb-v39.glb's materials, by the names KiCad's export and the footprints'
// models give them. Most arrive as glTF's defaults — metal, fully rough —
// which renders a blue capacitor sleeve and a black header as dull metal.
//
// Nothing on the board is a mirror. The capacitor's top and the terminals'
// screws were bright enough metal to hand the studio's strip lights straight
// back, over the bloom's threshold: loose parts on the bench looked lit from
// inside. They are satin now — stamped aluminium and plated steel are — and
// take less of the studio.
const PCB_TUNE: Record<string, Tune> = {
  // The pads are HASL — tin, not gold: bright, satin.
  pad_hasl: { color: LOOK.tin, roughness: 0.3, metalness: 1 },
  silkscreen: { color: "#f3f3ee", roughness: 0.86, metalness: 0 },
  // C11: its aluminium top, its sleeve (a shrink film), its leads, its base.
  mat_0: { roughness: 0.6, metalness: 1, env: 0.55 },
  mat_1: { roughness: 0.45, metalness: 0, env: 0.8 },
  mat_2: { roughness: 0.5, metalness: 1, env: 0.7 },
  mat_3: { roughness: 0.6, metalness: 0 },
  // The box header's and the pin sockets' black housings, and their gold contacts.
  mat_8: { roughness: 0.52, metalness: 0 },
  mat_6: { roughness: 0.52, metalness: 0 },
  mat_9: { color: LOOK.gold, roughness: 0.32, metalness: 1 },
  mat_7: { color: LOOK.gold, roughness: 0.32, metalness: 1 },
  // The screw terminals: blue housings (a moulded matt), plated screws and clamps.
  terminal_blue: { roughness: 0.62, metalness: 0, env: 0.7 },
  mat_5: { roughness: 0.58, metalness: 1, env: 0.55 },
  encoder_base: { roughness: 0.62, metalness: 0 },
};

// ── the solder mask ─────────────────────────────────────────────────────────
//
// The board's own material was one flat green: no sheen, nothing under it. A
// real board is a lacquer over copper and laminate. The lacquer is a clear
// coat — it takes a hard, narrow highlight over a satin body — and it is
// paler where there is copper under it and darker where there is not, with a
// small step at the copper's edge that catches a raking light. On this board
// both sides are poured (a ground plane each), so what shows is the plane,
// and every trace drawn in it by the dark line of its clearance.
//
// The copper is the board's own: F.Cu and B.Cu plotted from
// hardware/pcb/kicad/patternflow.kicad_pcb with kicad-cli (pcb export svg,
// board area only), rasterised, and packed into one image — red is the front
// layer, green the back (public/guide/look/pcb-v39-copper.webp). It is laid
// on by position: the board mesh is in metres, 62 × 116.26 mm about its
// centre in x and z, 1.51 thick, its front face up (+y).

/** The board's size in its mesh's own units (metres): x across, z along. */
const BOARD = { w: 0.062, h: 0.11626 };
const COPPER_URL = "/guide/look/pcb-v39-copper.webp";

let copper: { tex: { value: THREE.Texture }; on: { value: number } } | null = null;

/** The copper image, fetched once, the first time a board is tuned. Until it is here the board is all plane (as most of it is). */
function copperUniforms() {
  if (copper) return copper;
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 0, 255]), 1, 1, THREE.RGBAFormat);
  blank.needsUpdate = true;
  const c = (copper = { tex: { value: blank as THREE.Texture }, on: { value: 0 } });
  if (typeof window !== "undefined") {
    new THREE.TextureLoader().load(
      COPPER_URL,
      (t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 8;
        t.needsUpdate = true;
        c.tex.value = t;
        c.on.value = 1;
        blank.dispose();
      },
      undefined,
      // Without it the board is a plain lacquered green: still a board.
      () => undefined,
    );
  }
  return c;
}

/** The solder mask, in place of the board's flat green: the same name, so a second tuning finds it done. */
function maskMaterial(from: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    // The mask over bare laminate; over copper it is paler (below).
    color: "#0d5626",
    roughness: 0.5,
    metalness: 0,
    // A clear coat, not a mirror: at a graze the whole studio would be in it, and the board went white.
    clearcoat: 0.5,
    clearcoatRoughness: 0.28,
    specularIntensity: 0.6,
    envMapIntensity: 0.6,
    side: from.side,
    transparent: from.transparent,
    opacity: from.opacity,
  });
  m.name = from.name;
  const u = copperUniforms();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLkCopper = u.tex;
    shader.uniforms.uLkCopperOn = u.on;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLkPos;\nvarying vec3 vLkN;\nvarying vec3 vLkXV;\nvarying vec3 vLkZV;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLkPos = position;\nvLkN = normal;\nvLkXV = normalMatrix * vec3(1.0, 0.0, 0.0);\nvLkZV = normalMatrix * vec3(0.0, 0.0, 1.0);");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform sampler2D uLkCopper;
uniform float uLkCopperOn;
varying vec3 vLkPos;
varying vec3 vLkN;
varying vec3 vLkXV;
varying vec3 vLkZV;
// How much copper is under the mask at a point of the board, on the face being looked at.
float lkCopper(vec2 uv, float front) {
  vec2 c = texture2D(uLkCopper, uv).rg;
  return mix(c.g, c.r, front);
}`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
// The image's top row is the board's far end (−z); a texture is loaded bottom row first.
vec2 lkUv = vec2(vLkPos.x / ${BOARD.w} + 0.5, 0.5 - vLkPos.z / ${BOARD.h});
float lkFront = step(0.0, vLkN.y);
// Not on the board's cut edge: that is bare laminate.
float lkFace = smoothstep(0.5, 0.9, abs(vLkN.y));
float lkCu = lkCopper(lkUv, lkFront);
diffuseColor.rgb *= 1.0 + 0.36 * lkCu * lkFace;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
// The copper's edge under the lacquer: a step of a few hundredths of a millimetre, enough to catch a raking light.
vec2 lkStep = vec2(0.6 / 1024.0, 0.6 / 1920.0);
float lkDx = lkCopper(lkUv + vec2(lkStep.x, 0.0), lkFront) - lkCopper(lkUv - vec2(lkStep.x, 0.0), lkFront);
float lkDz = lkCopper(lkUv - vec2(0.0, lkStep.y), lkFront) - lkCopper(lkUv + vec2(0.0, lkStep.y), lkFront);
normal = normalize(normal - (normalize(vLkXV) * lkDx + normalize(vLkZV) * lkDz) * (0.22 * lkFace * uLkCopperOn));`,
      );
  };
  m.customProgramCacheKey = () => "look-mask-1";
  return m;
}

/**
 * Sets the board's materials (pcb-v39.glb, and its parts wherever they have
 * been hung) to what the parts are made of. Safe to call again: it sets
 * values, and the one material it replaces (the board's own, by the solder
 * mask) it replaces once — so a material faded or made transparent elsewhere
 * stays as it was.
 */
export function tunePcbMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // The board itself: its flat green is replaced, once, by the mask.
    const own = mesh.material as THREE.MeshStandardMaterial;
    if (!Array.isArray(own) && own.name === "pcb_green" && !(own as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
      mesh.material = maskMaterial(own);
      own.dispose();
      return;
    }
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const std = mat as THREE.MeshStandardMaterial;
      const tune = PCB_TUNE[std.name];
      if (!tune || !std.isMeshStandardMaterial) continue;
      if (tune.color) std.color.set(tune.color);
      std.roughness = tune.roughness;
      std.metalness = tune.metalness;
      if (tune.env) std.envMapIntensity = tune.env;
    }
  });
}
