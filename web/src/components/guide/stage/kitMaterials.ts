import * as THREE from "three";
import { KIT } from "./parts";

// The DevKit's own surfaces. devkit.glb gives its board and every part on it
// one pure-black material ("metal_b"), which rendered as a silhouette: black
// takes no light, so only the pins and the USB shells read. Here the board is
// told apart from what is soldered on it by where a surface is, not by a
// material the file doesn't have: a face pointing up at the height of the
// board's top (z 0.5 mm) is solder mask, at the WROOM module's own board
// (z 1.31 mm, above y 9 mm) the module's mask, anything else a part. The mask
// is a dark charcoal satin; on it goes the silkscreen the copy talks about —
// USB and UART over the ports, RST and BOOT beside the buttons — and, under
// the module's mask above the shield, its printed antenna.
//
// Heights and free areas measured off devkit.glb (a top-down height map of its
// board mesh). Canonical frame, metres: +X right, +Y antenna, +Z up.

const X0 = -0.0145;
const X1 = 0.0145;
const Y0 = -0.03;
const Y1 = 0.0355;
const PCB_Z = 0.0005;
const MODULE_Z = 0.00131;

/** Canvas px per metre: 768 across the 29 mm. */
const TEX_W = 768;
const TEX_H = Math.round((TEX_W * (Y1 - Y0)) / (X1 - X0));
const PX = TEX_W / (X1 - X0);
const px = (x: number) => (x - X0) * PX;
const py = (y: number) => (Y1 - y) * PX;

function silkscreen(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, TEX_W, TEX_H);
    // Red: silkscreen ink on the board.
    g.fillStyle = "#f00";
    g.strokeStyle = "#f00";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const label = (text: string, x: number, y: number, mm: number) => {
      g.font = `700 ${Math.round(mm * 0.001 * PX)}px ui-sans-serif, "Helvetica Neue", Arial, sans-serif`;
      g.fillText(text, px(x), py(y));
    };
    // Over each port, below the parts above it.
    label("USB", KIT.usb.x, -0.0193, 1.25);
    label("UART", KIT.uart.x, -0.0193, 1.25);
    // Right of the buttons, short of the pin header.
    label("RST", 0.0099, KIT.rst.y, 1.05);
    label("BOOT", 0.0099, KIT.boot.y, 1.05);
    // The buttons' outlines, as footprints are drawn.
    g.lineWidth = 0.15 * 0.001 * PX;
    for (const k of [KIT.rst, KIT.boot]) {
      const w = 0.0058 * PX;
      const h = 0.0036 * PX;
      g.strokeRect(px(k.x) - w / 2, py(k.y) - h / 2, w, h);
    }
    // Pin-1 dots at the headers' top ends.
    for (const x of [-0.0128, 0.0128]) {
      g.beginPath();
      g.arc(px(x), py(0.0305), 0.35 * 0.001 * PX, 0, Math.PI * 2);
      g.fill();
    }

    // Green: the printed antenna on the module's overhang, a meander from
    // its feed at the shield's corner along the top edge.
    g.strokeStyle = "#0f0";
    g.lineWidth = 0.45 * 0.001 * PX;
    g.lineJoin = "miter";
    g.beginPath();
    const top = 0.0338;
    const low = 0.0296;
    let x = -0.0072;
    g.moveTo(px(x), py(0.0282));
    g.lineTo(px(x), py(top));
    const pitch = 0.0016;
    let up = true;
    while (x + pitch < 0.0074) {
      g.lineTo(px(x + pitch), py(up ? top : low));
      x += pitch;
      g.lineTo(px(x), py(up ? low : top));
      up = !up;
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function boardMaterial(silk: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, metalness: 0 });
  m.name = "devkit_board";
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSilk = { value: silk };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vKitPos;\nvarying vec3 vKitN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKitPos = position;\nvKitN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vKitPos;
varying vec3 vKitN;
uniform sampler2D uSilk;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float kitUp = step(0.9, vKitN.z);
float kitPcb = kitUp * (1.0 - step(0.00004, abs(vKitPos.z - ${PCB_Z.toFixed(5)})));
float kitMod = kitUp * (1.0 - step(0.00004, abs(vKitPos.z - ${MODULE_Z.toFixed(5)}))) * step(0.009, vKitPos.y);
float kitMask = max(kitPcb, kitMod);
vec2 kitUv = vec2((vKitPos.x - (${X0})) / ${(X1 - X0).toFixed(5)}, (vKitPos.y - (${Y0})) / ${(Y1 - Y0).toFixed(5)});
vec4 kitSilk = texture2D(uSilk, kitUv);
// Parts: near-black epoxy. Mask: dark charcoal, a touch cool.
vec3 kitCol = mix(vec3(0.028, 0.028, 0.03), vec3(0.058, 0.062, 0.07), kitMask);
kitCol = mix(kitCol, vec3(0.1, 0.092, 0.08), kitSilk.g * kitMod);
kitCol = mix(kitCol, vec3(0.78, 0.78, 0.76), kitSilk.r * kitPcb);
diffuseColor.rgb = kitCol;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.34, 0.48, kitMask);
roughnessFactor = mix(roughnessFactor, 0.7, kitSilk.r * kitPcb);`,
      );
  };
  return m;
}

/** The DevKit's materials by the names devkit.glb gives them; null keeps the file's own. */
export function devkitMaterials() {
  const silk = silkscreen();
  const board = boardMaterial(silk);
  // The ports' black insides and tongues.
  const plastic = new THREE.MeshStandardMaterial({ color: "#0e0e10", roughness: 0.6, metalness: 0 });
  const shield = new THREE.MeshStandardMaterial({ color: "#8d9096", roughness: 0.58, metalness: 0.85 });
  return {
    forName(name: string): THREE.Material | null {
      if (name === "metal_b") return board;
      if (name.startsWith("metal_b.")) return plastic;
      // The module's can: brushed nickel, not a mirror (it caught the
      // DevKit's light as a white blaze).
      if (name === "metal.module") return shield;
      return null;
    },
  };
}
